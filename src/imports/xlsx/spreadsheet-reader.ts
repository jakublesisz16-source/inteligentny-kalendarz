import { readXlsFile, looksLikeLegacyXls } from './xls-reader';
import { readXlsxFile } from './xlsx-reader';
import type { WorkbookSnapshot } from './xlsx.types';

const MAX_SPREADSHEET_FILE_BYTES = 64 * 1024 * 1024;

function looksLikeZip(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 4) return false;
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (
    (bytes[2] === 0x03 && bytes[3] === 0x04)
    || (bytes[2] === 0x05 && bytes[3] === 0x06)
    || (bytes[2] === 0x07 && bytes[3] === 0x08)
  );
}

export type SpreadsheetSourceFormat = 'XLSX' | 'XLS';

export async function detectSpreadsheetFormat(file: File): Promise<SpreadsheetSourceFormat> {
  if (file.size > MAX_SPREADSHEET_FILE_BYTES) throw new Error('Plik Excel jest zbyt duży. Maksymalny obsługiwany rozmiar to 64 MB.');
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (looksLikeLegacyXls(header)) return 'XLS';
  if (looksLikeZip(header)) return 'XLSX';
  throw new Error('Plik nie jest rozpoznawalnym skoroszytem Excel .xlsx ani .xls.');
}

export async function readSpreadsheetFile(file: File): Promise<WorkbookSnapshot> {
  const format = await detectSpreadsheetFormat(file);
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
    throw new Error('Wybierz plik programu Excel w formacie .xlsx albo .xls.');
  }
  if (format === 'XLS' && !lowerName.endsWith('.xls')) {
    throw new Error('Zawartość pliku jest w formacie .xls, ale rozszerzenie nazwy jest inne. Popraw nazwę pliku i spróbuj ponownie.');
  }
  if (format === 'XLSX' && !lowerName.endsWith('.xlsx')) {
    throw new Error('Zawartość pliku jest w formacie .xlsx, ale rozszerzenie nazwy jest inne. Popraw nazwę pliku i spróbuj ponownie.');
  }
  return format === 'XLS' ? readXlsFile(file) : readXlsxFile(file);
}
