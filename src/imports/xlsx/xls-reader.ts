import type { SheetCellSnapshot, SheetMergeSnapshot, SheetSnapshot, WorkbookSnapshot } from './xlsx.types';

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;
const NO_STREAM = 0xffffffff;
const BIFF_EOF = 0x000a;
const BIFF_CONTINUE = 0x003c;
const BIFF_SST = 0x00fc;
const BIFF_BOUNDSHEET = 0x0085;
const BIFF_XF = 0x00e0;
const BIFF_FORMAT = 0x041e;
const BIFF_DATEMODE = 0x0022;
const MAX_XLS_FILE_BYTES = 64 * 1024 * 1024;

interface DirectoryEntry {
  name: string;
  type: number;
  startSector: number;
  size: number;
}

interface BoundSheet {
  name: string;
  offset: number;
}

interface WorkbookGlobals {
  sheets: BoundSheet[];
  sharedStrings: string[];
  xfFormats: number[];
  customFormats: Map<number, string>;
  date1904: boolean;
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function u16(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.byteLength) throw new Error('Uszkodzony plik XLS: odczyt poza zakresem.');
  return viewOf(bytes).getUint16(offset, true);
}

function u32(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.byteLength) throw new Error('Uszkodzony plik XLS: odczyt poza zakresem.');
  return viewOf(bytes).getUint32(offset, true);
}

function i32(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.byteLength) throw new Error('Uszkodzony plik XLS: odczyt poza zakresem.');
  return viewOf(bytes).getInt32(offset, true);
}

function f64(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 8 > bytes.byteLength) throw new Error('Uszkodzony plik XLS: odczyt poza zakresem.');
  return viewOf(bytes).getFloat64(offset, true);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function sliceChecked(bytes: Uint8Array, start: number, end: number): Uint8Array {
  if (start < 0 || end < start || end > bytes.byteLength) throw new Error('Uszkodzony plik XLS: nieprawidłowy zakres danych.');
  return bytes.subarray(start, end);
}

function isCfbSignature(bytes: Uint8Array): boolean {
  return bytes.byteLength >= CFB_SIGNATURE.length && CFB_SIGNATURE.every((value, index) => bytes[index] === value);
}

function sectorOffset(sectorId: number, sectorSize: number): number {
  return (sectorId + 1) * sectorSize;
}

function followChain(start: number, fat: number[], maxSectors: number): number[] {
  if (start === END_OF_CHAIN || start === FREE_SECTOR || start === NO_STREAM) return [];
  const result: number[] = [];
  const seen = new Set<number>();
  let current = start;
  while (current !== END_OF_CHAIN && current !== FREE_SECTOR) {
    if (!Number.isInteger(current) || current < 0 || current >= fat.length) throw new Error('Uszkodzony plik XLS: nieprawidłowy łańcuch sektorów.');
    if (seen.has(current)) throw new Error('Uszkodzony plik XLS: cykliczny łańcuch sektorów.');
    if (result.length >= maxSectors) throw new Error('Uszkodzony plik XLS: zbyt długi łańcuch sektorów.');
    seen.add(current);
    result.push(current);
    current = fat[current] ?? END_OF_CHAIN;
  }
  return result;
}

function readRegularStream(bytes: Uint8Array, start: number, size: number | undefined, fat: number[], sectorSize: number): Uint8Array {
  const chain = followChain(start, fat, Math.ceil(bytes.byteLength / sectorSize) + 2);
  const parts = chain.map((sectorId) => {
    const offset = sectorOffset(sectorId, sectorSize);
    return sliceChecked(bytes, offset, Math.min(offset + sectorSize, bytes.byteLength));
  });
  const joined = concatBytes(parts);
  return size === undefined ? joined : joined.subarray(0, Math.min(size, joined.byteLength));
}

function decodeUtf16Le(bytes: Uint8Array): string {
  return new TextDecoder('utf-16le').decode(bytes);
}

function decodeWindows1250(bytes: Uint8Array): string {
  try {
    return new TextDecoder('windows-1250').decode(bytes);
  } catch {
    return String.fromCharCode(...bytes);
  }
}

function parseDirectory(bytes: Uint8Array): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  for (let offset = 0; offset + 128 <= bytes.byteLength; offset += 128) {
    const entry = bytes.subarray(offset, offset + 128);
    const nameLength = u16(entry, 64);
    if (nameLength < 2 || nameLength > 64) continue;
    const name = decodeUtf16Le(entry.subarray(0, nameLength - 2)).replace(/\0+$/g, '');
    if (!name) continue;
    const type = entry[66] ?? 0;
    const startSector = u32(entry, 116);
    const lowSize = u32(entry, 120);
    const highSize = u32(entry, 124);
    const size = highSize * 0x100000000 + lowSize;
    entries.push({ name, type, startSector, size });
  }
  return entries;
}

function extractWorkbookStream(fileBytes: Uint8Array): Uint8Array {
  if (!isCfbSignature(fileBytes)) throw new Error('Plik nie jest prawidłowym skoroszytem Excel 97-2003 (.xls).');
  if (fileBytes.byteLength < 512) throw new Error('Uszkodzony plik XLS: nagłówek jest niepełny.');

  const sectorShift = u16(fileBytes, 30);
  const miniSectorShift = u16(fileBytes, 32);
  const sectorSize = 2 ** sectorShift;
  const miniSectorSize = 2 ** miniSectorShift;
  if (![512, 4096].includes(sectorSize) || miniSectorSize !== 64) throw new Error('Nieobsługiwany wariant kontenera XLS.');

  const maxSectorCount = Math.max(0, Math.floor(fileBytes.byteLength / sectorSize) - 1);
  const fatSectorCount = u32(fileBytes, 44);
  const firstDirectorySector = u32(fileBytes, 48);
  const miniStreamCutoff = u32(fileBytes, 56);
  const firstMiniFatSector = u32(fileBytes, 60);
  const miniFatSectorCount = u32(fileBytes, 64);
  const firstDifatSector = u32(fileBytes, 68);
  const difatSectorCount = u32(fileBytes, 72);
  if (fatSectorCount > maxSectorCount || miniFatSectorCount > maxSectorCount || difatSectorCount > maxSectorCount) {
    throw new Error('Uszkodzony plik XLS: nieprawidłowa liczba sektorów kontenera.');
  }

  const difat: number[] = [];
  for (let index = 0; index < 109; index += 1) {
    const sectorId = u32(fileBytes, 76 + index * 4);
    if (sectorId !== FREE_SECTOR && sectorId !== END_OF_CHAIN) difat.push(sectorId);
  }

  let difatSector = firstDifatSector;
  const difatEntriesPerSector = sectorSize / 4 - 1;
  const seenDifat = new Set<number>();
  for (let index = 0; index < difatSectorCount && difatSector !== END_OF_CHAIN && difatSector !== FREE_SECTOR; index += 1) {
    if (seenDifat.has(difatSector)) throw new Error('Uszkodzony plik XLS: cykliczny DIFAT.');
    seenDifat.add(difatSector);
    const offset = sectorOffset(difatSector, sectorSize);
    const sector = sliceChecked(fileBytes, offset, offset + sectorSize);
    for (let entry = 0; entry < difatEntriesPerSector; entry += 1) {
      const sectorId = u32(sector, entry * 4);
      if (sectorId !== FREE_SECTOR && sectorId !== END_OF_CHAIN) difat.push(sectorId);
    }
    difatSector = u32(sector, difatEntriesPerSector * 4);
  }

  const fatSectors = difat.slice(0, fatSectorCount);
  if (fatSectors.length !== fatSectorCount) throw new Error('Uszkodzony plik XLS: niepełna tablica FAT.');
  const fat: number[] = [];
  for (const fatSector of fatSectors) {
    const offset = sectorOffset(fatSector, sectorSize);
    const sector = sliceChecked(fileBytes, offset, offset + sectorSize);
    for (let cursor = 0; cursor < sector.byteLength; cursor += 4) fat.push(u32(sector, cursor));
  }

  const directoryBytes = readRegularStream(fileBytes, firstDirectorySector, undefined, fat, sectorSize);
  const directory = parseDirectory(directoryBytes);
  const root = directory.find((entry) => entry.type === 5);
  const workbook = directory.find((entry) => entry.type === 2 && /^(workbook|book)$/i.test(entry.name));
  if (!workbook) throw new Error('Plik XLS nie zawiera strumienia skoroszytu Workbook.');
  if (workbook.size <= 0 || workbook.size > fileBytes.byteLength * 16) throw new Error('Uszkodzony plik XLS: nieprawidłowy rozmiar skoroszytu.');

  if (workbook.size >= miniStreamCutoff) return readRegularStream(fileBytes, workbook.startSector, workbook.size, fat, sectorSize);
  if (!root) throw new Error('Uszkodzony plik XLS: brak głównego strumienia mini-sektorów.');

  const miniFatBytes = miniFatSectorCount
    ? readRegularStream(fileBytes, firstMiniFatSector, miniFatSectorCount * sectorSize, fat, sectorSize)
    : new Uint8Array();
  const miniFat: number[] = [];
  for (let offset = 0; offset + 4 <= miniFatBytes.byteLength; offset += 4) miniFat.push(u32(miniFatBytes, offset));
  const miniStream = readRegularStream(fileBytes, root.startSector, root.size, fat, sectorSize);
  const chain = followChain(workbook.startSector, miniFat, Math.ceil(miniStream.byteLength / miniSectorSize) + 2);
  const parts = chain.map((sectorId) => {
    const offset = sectorId * miniSectorSize;
    return sliceChecked(miniStream, offset, Math.min(offset + miniSectorSize, miniStream.byteLength));
  });
  return concatBytes(parts).subarray(0, workbook.size);
}

class SstCursor {
  private chunkIndex = 0;
  private offset = 0;

  constructor(private readonly chunks: Uint8Array[]) {}

  private advanceEmptyChunks(): void {
    while (this.chunkIndex < this.chunks.length && this.offset >= (this.chunks[this.chunkIndex]?.byteLength ?? 0)) {
      this.chunkIndex += 1;
      this.offset = 0;
    }
  }

  atChunkEnd(): boolean {
    const chunk = this.chunks[this.chunkIndex];
    return Boolean(chunk && this.offset >= chunk.byteLength);
  }

  nextChunk(): void {
    this.chunkIndex += 1;
    this.offset = 0;
    if (this.chunkIndex >= this.chunks.length) throw new Error('Uszkodzony plik XLS: przerwany rekord SST.');
  }

  remainingInChunk(): number {
    this.advanceEmptyChunks();
    return this.chunks[this.chunkIndex] ? (this.chunks[this.chunkIndex]?.byteLength ?? 0) - this.offset : 0;
  }

  read(length: number): Uint8Array {
    const result = new Uint8Array(length);
    let written = 0;
    while (written < length) {
      this.advanceEmptyChunks();
      const chunk = this.chunks[this.chunkIndex];
      if (!chunk) throw new Error('Uszkodzony plik XLS: niepełny rekord SST.');
      const available = chunk.byteLength - this.offset;
      const take = Math.min(length - written, available);
      result.set(chunk.subarray(this.offset, this.offset + take), written);
      this.offset += take;
      written += take;
    }
    return result;
  }

  readU8(): number { return this.read(1)[0] ?? 0; }
  readU16(): number { return u16(this.read(2), 0); }
  readU32(): number { return u32(this.read(4), 0); }
}

function parseSharedStrings(chunks: Uint8Array[]): string[] {
  if (!chunks.length) return [];
  const cursor = new SstCursor(chunks);
  cursor.readU32(); // liczba wszystkich odwołań
  const uniqueCount = cursor.readU32();
  if (uniqueCount > 1_000_000) throw new Error('Uszkodzony plik XLS: nieprawidłowa liczba tekstów SST.');
  const strings: string[] = [];

  for (let index = 0; index < uniqueCount; index += 1) {
    const charCount = cursor.readU16();
    const flags = cursor.readU8();
    const rich = Boolean(flags & 0x08);
    const extended = Boolean(flags & 0x04);
    let highByte = Boolean(flags & 0x01);
    const richRunCount = rich ? cursor.readU16() : 0;
    const extendedLength = extended ? cursor.readU32() : 0;
    let remainingChars = charCount;
    let value = '';

    while (remainingChars > 0) {
      if (cursor.atChunkEnd()) {
        cursor.nextChunk();
        highByte = Boolean(cursor.readU8() & 0x01);
      }
      const bytesPerChar = highByte ? 2 : 1;
      const availableChars = Math.floor(cursor.remainingInChunk() / bytesPerChar);
      if (availableChars <= 0) {
        cursor.nextChunk();
        highByte = Boolean(cursor.readU8() & 0x01);
        continue;
      }
      const takeChars = Math.min(remainingChars, availableChars);
      const raw = cursor.read(takeChars * bytesPerChar);
      value += highByte ? decodeUtf16Le(raw) : String.fromCharCode(...raw);
      remainingChars -= takeChars;
    }

    if (richRunCount) cursor.read(richRunCount * 4);
    if (extendedLength) cursor.read(extendedLength);
    strings.push(value);
  }
  return strings;
}

function decodeBiffUnicodeString(bytes: Uint8Array, offset: number, lengthBytes: 1 | 2): { value: string; next: number } {
  const charCount = lengthBytes === 1 ? (bytes[offset] ?? 0) : u16(bytes, offset);
  let cursor = offset + lengthBytes;
  const flags = bytes[cursor] ?? 0;
  cursor += 1;
  const highByte = Boolean(flags & 0x01);
  const byteLength = charCount * (highByte ? 2 : 1);
  const raw = sliceChecked(bytes, cursor, cursor + byteLength);
  return { value: highByte ? decodeUtf16Le(raw) : String.fromCharCode(...raw), next: cursor + byteLength };
}

function parseWorkbookGlobals(workbook: Uint8Array): WorkbookGlobals {
  const sheets: BoundSheet[] = [];
  const xfFormats: number[] = [];
  const customFormats = new Map<number, string>();
  const sstChunks: Uint8Array[] = [];
  let collectingSst = false;
  let date1904 = false;
  let offset = 0;

  while (offset + 4 <= workbook.byteLength) {
    const recordId = u16(workbook, offset);
    const length = u16(workbook, offset + 2);
    const payloadStart = offset + 4;
    const payloadEnd = payloadStart + length;
    if (payloadEnd > workbook.byteLength) throw new Error('Uszkodzony plik XLS: niepełny rekord BIFF.');
    const payload = workbook.subarray(payloadStart, payloadEnd);

    if (recordId === BIFF_SST) {
      collectingSst = true;
      sstChunks.push(payload);
    } else if (recordId === BIFF_CONTINUE && collectingSst) {
      sstChunks.push(payload);
    } else {
      collectingSst = false;
    }

    if (recordId === BIFF_BOUNDSHEET && payload.byteLength >= 8) {
      const sheetOffset = u32(payload, 0);
      const name = decodeBiffUnicodeString(payload, 6, 1).value;
      if (name) sheets.push({ name, offset: sheetOffset });
    } else if (recordId === BIFF_XF && payload.byteLength >= 4) {
      xfFormats.push(u16(payload, 2));
    } else if (recordId === BIFF_FORMAT && payload.byteLength >= 5) {
      const formatIndex = u16(payload, 0);
      customFormats.set(formatIndex, decodeBiffUnicodeString(payload, 2, 2).value);
    } else if (recordId === BIFF_DATEMODE && payload.byteLength >= 2) {
      date1904 = u16(payload, 0) === 1;
    }

    offset = payloadEnd;
    if (recordId === BIFF_EOF && sheets.length) break;
  }

  return { sheets, sharedStrings: parseSharedStrings(sstChunks), xfFormats, customFormats, date1904 };
}

function columnName(col: number): string {
  let value = col;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function cellAddress(row: number, col: number): string {
  return `${columnName(col)}${row}`;
}

function excelSerialDate(value: number, date1904: boolean): string | null {
  if (!Number.isFinite(value) || value < 0 || value > 100000) return null;
  const wholeDays = Math.floor(value);
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  const adjustedDays = date1904 ? wholeDays : wholeDays >= 60 ? wholeDays - 1 : wholeDays;
  const date = new Date(epoch + adjustedDays * 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function dateLikeFormat(formatIndex: number, customFormats: Map<number, string>): boolean {
  const builtInDates = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
  if (builtInDates.has(formatIndex)) return true;
  const format = customFormats.get(formatIndex);
  if (!format) return false;
  const normalized = format.replace(/\\./g, '').replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').toLowerCase();
  const hasDay = /(^|[^a-z])d{1,4}([^a-z]|$)/.test(normalized);
  const hasMonth = /(^|[^a-z])m{1,4}([^a-z]|$)/.test(normalized);
  const hasYear = /(^|[^a-z])y{2,4}([^a-z]|$)/.test(normalized);
  return (hasDay && hasMonth) || (hasMonth && hasYear);
}

function decodeRk(raw: number): number {
  const multipliedBy100 = Boolean(raw & 0x01);
  const integer = Boolean(raw & 0x02);
  let value: number;
  if (integer) {
    value = (raw | 0) >> 2;
  } else {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(0, 0, true);
    view.setUint32(4, raw & 0xfffffffc, true);
    value = view.getFloat64(0, true);
  }
  return multipliedBy100 ? value / 100 : value;
}

function numericCell(row: number, col: number, value: number, xfIndex: number, globals: WorkbookGlobals): SheetCellSnapshot {
  const formatIndex = globals.xfFormats[xfIndex] ?? 0;
  const dateValue = dateLikeFormat(formatIndex, globals.customFormats) ? excelSerialDate(value, globals.date1904) : null;
  if (dateValue) return { row, col, address: cellAddress(row, col), value: dateValue, valueType: 'date', dateValue };
  const text = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));
  return { row, col, address: cellAddress(row, col), value: text, valueType: 'number' };
}

function parseLegacyLabel(payload: Uint8Array): string {
  if (payload.byteLength < 8) return '';
  const charCount = u16(payload, 6);
  if (payload.byteLength >= 9) {
    const flags = payload[8] ?? 0;
    const highByte = Boolean(flags & 0x01);
    const length = charCount * (highByte ? 2 : 1);
    if (9 + length <= payload.byteLength) {
      const raw = payload.subarray(9, 9 + length);
      return highByte ? decodeUtf16Le(raw) : String.fromCharCode(...raw);
    }
  }
  const raw = payload.subarray(8, Math.min(payload.byteLength, 8 + charCount));
  return decodeWindows1250(raw);
}

function parseSheet(workbook: Uint8Array, bound: BoundSheet, globals: WorkbookGlobals): SheetSnapshot {
  if (!Number.isInteger(bound.offset) || bound.offset < 0 || bound.offset + 4 > workbook.byteLength) {
    throw new Error(`Uszkodzony plik XLS: nieprawidłowy początek arkusza ${bound.name}.`);
  }
  const cells = new Map<string, SheetCellSnapshot>();
  const merges: SheetMergeSnapshot[] = [];
  const hiddenRows = new Set<number>();
  const hiddenColumns = new Set<number>();
  let minRow = Number.POSITIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxRow = 1;
  let maxCol = 1;
  let offset = bound.offset;

  const addCell = (cell: SheetCellSnapshot) => {
    if (!cell.value && !cell.dateValue) return;
    cells.set(`${cell.row}:${cell.col}`, cell);
    minRow = Math.min(minRow, cell.row);
    minCol = Math.min(minCol, cell.col);
    maxRow = Math.max(maxRow, cell.row);
    maxCol = Math.max(maxCol, cell.col);
  };

  while (offset + 4 <= workbook.byteLength) {
    const recordId = u16(workbook, offset);
    const length = u16(workbook, offset + 2);
    const payloadStart = offset + 4;
    const payloadEnd = payloadStart + length;
    if (payloadEnd > workbook.byteLength) throw new Error(`Uszkodzony plik XLS: niepełny rekord w arkuszu ${bound.name}.`);
    const payload = workbook.subarray(payloadStart, payloadEnd);

    if (recordId === 0x00fd && payload.byteLength >= 10) { // LABELSST
      const row = u16(payload, 0) + 1;
      const col = u16(payload, 2) + 1;
      const sstIndex = u32(payload, 6);
      const value = globals.sharedStrings[sstIndex] ?? '';
      addCell({ row, col, address: cellAddress(row, col), value, valueType: 'text' });
    } else if (recordId === 0x0203 && payload.byteLength >= 14) { // NUMBER
      addCell(numericCell(u16(payload, 0) + 1, u16(payload, 2) + 1, f64(payload, 6), u16(payload, 4), globals));
    } else if (recordId === 0x027e && payload.byteLength >= 10) { // RK
      addCell(numericCell(u16(payload, 0) + 1, u16(payload, 2) + 1, decodeRk(u32(payload, 6)), u16(payload, 4), globals));
    } else if (recordId === 0x00bd && payload.byteLength >= 12) { // MULRK
      const row = u16(payload, 0) + 1;
      let col = u16(payload, 2) + 1;
      for (let cursor = 4; cursor + 6 <= payload.byteLength - 2; cursor += 6, col += 1) {
        addCell(numericCell(row, col, decodeRk(u32(payload, cursor + 2)), u16(payload, cursor), globals));
      }
    } else if (recordId === 0x0204 && payload.byteLength >= 8) { // LABEL
      const row = u16(payload, 0) + 1;
      const col = u16(payload, 2) + 1;
      const value = parseLegacyLabel(payload);
      addCell({ row, col, address: cellAddress(row, col), value, valueType: 'text' });
    } else if (recordId === 0x0205 && payload.byteLength >= 8) { // BOOLERR
      const row = u16(payload, 0) + 1;
      const col = u16(payload, 2) + 1;
      const isError = Boolean(payload[7]);
      if (!isError) addCell({ row, col, address: cellAddress(row, col), value: payload[6] ? 'TRUE' : 'FALSE', valueType: 'text' });
    } else if (recordId === 0x0006 && payload.byteLength >= 14) { // FORMULA - numeric result only
      const resultMarker = u16(payload, 6);
      if (resultMarker !== 0xffff) addCell(numericCell(u16(payload, 0) + 1, u16(payload, 2) + 1, f64(payload, 6), u16(payload, 4), globals));
    } else if (recordId === 0x00e5 && payload.byteLength >= 2) { // MERGEDCELLS
      const count = u16(payload, 0);
      for (let index = 0; index < count; index += 1) {
        const cursor = 2 + index * 8;
        if (cursor + 8 > payload.byteLength) break;
        const startRow = u16(payload, cursor) + 1;
        const endRow = u16(payload, cursor + 2) + 1;
        const startCol = u16(payload, cursor + 4) + 1;
        const endCol = u16(payload, cursor + 6) + 1;
        merges.push({
          ref: `${cellAddress(startRow, startCol)}:${cellAddress(endRow, endCol)}`,
          startRow, startCol, endRow, endCol,
        });
        minRow = Math.min(minRow, startRow);
        minCol = Math.min(minCol, startCol);
        maxRow = Math.max(maxRow, endRow);
        maxCol = Math.max(maxCol, endCol);
      }
    } else if (recordId === 0x0208 && payload.byteLength >= 16) { // ROW
      const row = u16(payload, 0) + 1;
      const options = u16(payload, 12);
      if (options & 0x0020) hiddenRows.add(row);
    } else if (recordId === 0x007d && payload.byteLength >= 10) { // COLINFO
      const firstCol = u16(payload, 0) + 1;
      const lastCol = u16(payload, 2) + 1;
      const options = u16(payload, 8);
      if (options & 0x0001) for (let col = firstCol; col <= lastCol; col += 1) hiddenColumns.add(col);
    }

    offset = payloadEnd;
    if (recordId === BIFF_EOF) break;
  }

  if (!Number.isFinite(minRow)) minRow = 1;
  if (!Number.isFinite(minCol)) minCol = 1;
  return {
    name: bound.name,
    usedRange: `${cellAddress(minRow, minCol)}:${cellAddress(maxRow, maxCol)}`,
    minRow,
    minCol,
    maxRow,
    maxCol,
    cells: [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col),
    merges,
    ...(hiddenRows.size ? { hiddenRows: [...hiddenRows].sort((a, b) => a - b) } : {}),
    ...(hiddenColumns.size ? { hiddenColumns: [...hiddenColumns].sort((a, b) => a - b) } : {}),
  };
}

export async function readXlsFile(file: File): Promise<WorkbookSnapshot> {
  if (file.size > MAX_XLS_FILE_BYTES) throw new Error('Plik XLS jest zbyt duży. Maksymalny obsługiwany rozmiar to 64 MB.');
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const workbook = extractWorkbookStream(fileBytes);
  const globals = parseWorkbookGlobals(workbook);
  if (!globals.sheets.length) throw new Error('Plik XLS nie zawiera arkuszy możliwych do odczytu.');
  const sheets = globals.sheets.map((sheet) => parseSheet(workbook, sheet, globals));
  return { sheetNames: sheets.map((sheet) => sheet.name), sheets };
}

export function looksLikeLegacyXls(bytes: Uint8Array): boolean {
  return isCfbSignature(bytes);
}
