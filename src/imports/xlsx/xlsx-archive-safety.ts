const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const MAX_EOCD_SEARCH_BYTES = 65_557; // 22-byte EOCD + maximum ZIP comment (65,535 bytes)

export const MAX_XLSX_ARCHIVE_BYTES = 64 * 1024 * 1024;
export const MAX_XLSX_CENTRAL_DIRECTORY_BYTES = 8 * 1024 * 1024;
export const MAX_XLSX_ENTRY_COUNT = 4096;
export const MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
export const MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
export const MAX_XLSX_COMPRESSION_RATIO = 200;

const REQUIRED_XLSX_ENTRIES = new Set(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml']);

function fail(message: string): never {
  throw new Error(`Nie można bezpiecznie otworzyć pliku XLSX: ${message}`);
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  if (bytes.byteLength < 22) return -1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) !== EOCD_SIGNATURE) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + 22 + commentLength === bytes.byteLength) return offset;
  }
  return -1;
}

function decodedFileName(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\\/g, '/');
  } catch {
    return '';
  }
}

export interface XlsxArchiveSafetySummary {
  entryCount: number;
  totalCompressedBytes: number;
  totalUncompressedBytes: number;
  maximumCompressionRatio: number;
}

export async function validateXlsxArchiveSafety(file: File): Promise<XlsxArchiveSafetySummary> {
  if (file.size > MAX_XLSX_ARCHIVE_BYTES) fail(`plik przekracza ${MAX_XLSX_ARCHIVE_BYTES / (1024 * 1024)} MB.`);
  if (file.size < 22) fail('archiwum ZIP jest zbyt krótkie albo uszkodzone.');

  const tailStart = Math.max(0, file.size - MAX_EOCD_SEARCH_BYTES);
  const tail = new Uint8Array(await file.slice(tailStart).arrayBuffer());
  const eocdOffsetInTail = findEndOfCentralDirectory(tail);
  if (eocdOffsetInTail < 0) fail('nie znaleziono poprawnego katalogu centralnego ZIP.');

  const eocd = new DataView(tail.buffer, tail.byteOffset + eocdOffsetInTail, tail.byteLength - eocdOffsetInTail);
  const diskNumber = eocd.getUint16(4, true);
  const centralDirectoryDisk = eocd.getUint16(6, true);
  const entriesOnDisk = eocd.getUint16(8, true);
  const entryCount = eocd.getUint16(10, true);
  const centralDirectorySize = eocd.getUint32(12, true);
  const centralDirectoryOffset = eocd.getUint32(16, true);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
    fail('wieloczęściowe archiwa ZIP nie są obsługiwane.');
  }
  if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    fail('format ZIP64 nie jest obsługiwany dla importu planu.');
  }
  if (entryCount <= 0) fail('archiwum nie zawiera żadnych wpisów.');
  if (entryCount > MAX_XLSX_ENTRY_COUNT) fail(`archiwum zawiera zbyt wiele wpisów (${entryCount}; limit ${MAX_XLSX_ENTRY_COUNT}).`);
  if (centralDirectorySize <= 0 || centralDirectorySize > MAX_XLSX_CENTRAL_DIRECTORY_BYTES) {
    fail('katalog centralny ZIP ma niebezpieczny rozmiar.');
  }
  if (centralDirectoryOffset + centralDirectorySize > file.size) fail('katalog centralny ZIP wskazuje poza plik.');

  const centralBytes = new Uint8Array(await file.slice(centralDirectoryOffset, centralDirectoryOffset + centralDirectorySize).arrayBuffer());
  const central = new DataView(centralBytes.buffer, centralBytes.byteOffset, centralBytes.byteLength);

  let offset = 0;
  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;
  let maximumCompressionRatio = 1;
  const foundRequiredEntries = new Set<string>();

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > centralBytes.byteLength || central.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      fail('katalog centralny ZIP jest niespójny.');
    }

    const flags = central.getUint16(offset + 8, true);
    const compressedBytes = central.getUint32(offset + 20, true);
    const uncompressedBytes = central.getUint32(offset + 24, true);
    const fileNameLength = central.getUint16(offset + 28, true);
    const extraLength = central.getUint16(offset + 30, true);
    const commentLength = central.getUint16(offset + 32, true);
    const nextOffset = offset + 46 + fileNameLength + extraLength + commentLength;

    if (nextOffset > centralBytes.byteLength) fail('wpis katalogu centralnego ZIP jest ucięty.');
    if ((flags & 0x0001) !== 0) fail('zaszyfrowane wpisy ZIP nie są obsługiwane.');
    if (compressedBytes === 0xffffffff || uncompressedBytes === 0xffffffff) fail('wpis ZIP64 nie jest obsługiwany.');
    if (uncompressedBytes > MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES) {
      fail(`pojedynczy wpis po rozpakowaniu przekracza ${MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES / (1024 * 1024)} MB.`);
    }

    totalCompressedBytes += compressedBytes;
    totalUncompressedBytes += uncompressedBytes;
    if (totalUncompressedBytes > MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES) {
      fail(`łączny deklarowany rozmiar po rozpakowaniu przekracza ${MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES / (1024 * 1024)} MB.`);
    }

    if (uncompressedBytes > 0) {
      if (compressedBytes <= 0) fail('wpis ma dodatni rozmiar po rozpakowaniu, ale zerowy rozmiar skompresowany.');
      const ratio = uncompressedBytes / compressedBytes;
      maximumCompressionRatio = Math.max(maximumCompressionRatio, ratio);
      if (ratio > MAX_XLSX_COMPRESSION_RATIO) {
        fail(`wpis ma podejrzanie wysoki współczynnik kompresji (${ratio.toFixed(1)}x; limit ${MAX_XLSX_COMPRESSION_RATIO}x).`);
      }
    }

    const nameStart = offset + 46;
    const name = decodedFileName(centralBytes.subarray(nameStart, nameStart + fileNameLength));
    if (REQUIRED_XLSX_ENTRIES.has(name)) foundRequiredEntries.add(name);
    offset = nextOffset;
  }

  for (const required of REQUIRED_XLSX_ENTRIES) {
    if (!foundRequiredEntries.has(required)) fail(`brakuje wymaganego wpisu ${required}.`);
  }

  return { entryCount, totalCompressedBytes, totalUncompressedBytes, maximumCompressionRatio };
}
