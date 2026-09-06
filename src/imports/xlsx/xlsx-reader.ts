import ExcelJS, { type Worksheet } from 'exceljs';
import type { SheetCellSnapshot, SheetMergeSnapshot, SheetSnapshot, WorkbookSnapshot } from './xlsx.types';
import { validateXlsxArchiveSafety } from './xlsx-archive-safety';

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

function parseAddress(address: string): { row: number; col: number } {
  const match = /^([A-Z]+)(\d+)$/i.exec(address);
  if (!match) throw new Error(`Nieprawidłowy adres komórki: ${address}`);
  let col = 0;
  const columnToken = match[1];
  const rowToken = match[2];
  if (!columnToken || !rowToken) throw new Error(`Nieprawidłowy adres komórki: ${address}`);
  for (const character of columnToken.toUpperCase()) col = col * 26 + character.charCodeAt(0) - 64;
  return { row: Number(rowToken), col };
}

function parseMerge(ref: string): SheetMergeSnapshot {
  const parts = ref.split(':');
  const startRef = parts[0];
  const endRef = parts[1] ?? startRef;
  if (!startRef || !endRef) throw new Error(`Nieprawidłowy zakres scalonych komórek: ${ref}`);
  const start = parseAddress(startRef);
  const end = parseAddress(endRef);
  return { ref, startRow: start.row, startCol: start.col, endRow: end.row, endCol: end.col };
}

function isCoveredMergeChild(row: number, col: number, merges: SheetMergeSnapshot[]): boolean {
  return merges.some((merge) => row >= merge.startRow && row <= merge.endRow && col >= merge.startCol && col <= merge.endCol && (row !== merge.startRow || col !== merge.startCol));
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function excelJsDecodedDateSerial(value: Date, date1904: boolean): number | null {
  if (Number.isNaN(value.getTime())) return null;
  const calendarDayUtc = Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return Math.round((calendarDayUtc - epoch) / DAY_MS);
}

function normalizedExcelDate(value: Date, date1904: boolean): string {
  const serial = excelJsDecodedDateSerial(value, date1904);
  const normalized = serial === null ? null : excelSerialDate(serial, date1904);
  return normalized ?? isoDate(value);
}

function dateLikeNumberFormat(numFmt: string | undefined): boolean {
  if (!numFmt) return false;
  const normalized = numFmt
    .replace(/\\./g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .toLowerCase();
  const hasDay = /(^|[^a-z])d{1,4}([^a-z]|$)/.test(normalized);
  const hasMonth = /(^|[^a-z])m{1,4}([^a-z]|$)/.test(normalized);
  const hasYear = /(^|[^a-z])y{2,4}([^a-z]|$)/.test(normalized);
  return (hasDay && hasMonth) || (hasMonth && hasYear);
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

function snapshotCell(cell: ExcelJS.Cell, row: number, col: number, date1904: boolean): SheetCellSnapshot | null {
  const text = cell.text.trim();
  const rawValue = cell.value;
  if (!text && (rawValue === null || rawValue === undefined || rawValue === '')) return null;

  if (rawValue instanceof Date) {
    const normalizedDate = normalizedExcelDate(rawValue, date1904);
    return { row, col, address: cell.address, value: text || normalizedDate, valueType: 'date', dateValue: normalizedDate };
  }
  if (typeof rawValue === 'number') {
    const serialDate = dateLikeNumberFormat(cell.numFmt) ? excelSerialDate(rawValue, date1904) : null;
    if (serialDate) return { row, col, address: cell.address, value: text || serialDate, valueType: 'date', dateValue: serialDate };
    return { row, col, address: cell.address, value: text || String(rawValue), valueType: 'number' };
  }
  return { row, col, address: cell.address, value: text, valueType: 'text' };
}

function sheetSnapshot(worksheet: Worksheet, date1904: boolean): SheetSnapshot {
  const mergeRefs = ((worksheet.model as unknown as { merges?: string[] }).merges ?? []);
  const merges = mergeRefs.map(parseMerge);
  const cells: SheetCellSnapshot[] = [];
  let minRow = Number.POSITIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxRow = 1;
  let maxCol = 1;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (isCoveredMergeChild(rowNumber, colNumber, merges)) return;
      const snapshot = snapshotCell(cell, rowNumber, colNumber, date1904);
      if (!snapshot) return;
      cells.push(snapshot);
      minRow = Math.min(minRow, rowNumber);
      minCol = Math.min(minCol, colNumber);
      maxRow = Math.max(maxRow, rowNumber);
      maxCol = Math.max(maxCol, colNumber);
    });
  });

  for (const merge of merges) {
    minRow = Math.min(minRow, merge.startRow);
    minCol = Math.min(minCol, merge.startCol);
    maxRow = Math.max(maxRow, merge.endRow);
    maxCol = Math.max(maxCol, merge.endCol);
  }

  if (!Number.isFinite(minRow)) minRow = 1;
  if (!Number.isFinite(minCol)) minCol = 1;
  const hiddenRows: number[] = [];
  const hiddenColumns: number[] = [];
  for (let row = minRow; row <= maxRow; row += 1) if (worksheet.getRow(row).hidden) hiddenRows.push(row);
  for (let col = minCol; col <= maxCol; col += 1) if (worksheet.getColumn(col).hidden) hiddenColumns.push(col);

  const usedRange = `${columnName(minCol)}${minRow}:${columnName(maxCol)}${maxRow}`;
  return {
    name: worksheet.name,
    usedRange,
    minRow,
    minCol,
    maxRow,
    maxCol,
    cells,
    merges,
    ...(hiddenRows.length ? { hiddenRows } : {}),
    ...(hiddenColumns.length ? { hiddenColumns } : {}),
  };
}

export async function readXlsxFile(file: File): Promise<WorkbookSnapshot> {
  await validateXlsxArchiveSafety(file);
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  const loadInput = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(loadInput);
  const date1904 = Boolean(workbook.properties.date1904);
  const sheets = workbook.worksheets.map((worksheet) => sheetSnapshot(worksheet, date1904));
  return { sheetNames: sheets.map((sheet) => sheet.name), sheets };
}
