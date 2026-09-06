import ExcelJS, { type Worksheet } from 'exceljs';
import type { BackupDocument } from '../safety/safety.types';
import type { ExpenseCategory, Receipt } from '../shopping/expenses.types';

const EXCEL_CELL_TEXT_LIMIT = 32_767;
const PLN_FORMAT = '#,##0.00 [$zł-pl-PL]';
const DATE_FORMAT = 'dd.mm.yyyy';
const DATE_TIME_FORMAT = 'dd.mm.yyyy hh:mm';

const COLORS = {
  background: 'F5F3EF',
  surface: 'FFFDFC',
  accent: 'CF789B',
  accentStrong: 'B65F82',
  text: '1F2725',
  muted: '6F7774',
  line: 'D8D3CA',
  white: 'FFFFFF',
} as const;

export const CANONICAL_STORE_SHEET_NAMES: Record<string, string> = {
  events: 'Wydarzenia',
  locations: 'Miejsca',
  settings: 'Ustawienia',
  meta: 'Meta',
  universityImports: 'Importy studiów',
  universityImportEntries: 'Pozycje studiów',
  studyProfile: 'Profil studiów',
  scheduleUpdateSessions: 'Aktualizacje studiów',
  studyCorrectionRules: 'Korekty studiów',
  trashItems: 'Kosz',
  dayConstraints: 'Ograniczenia dni',
  studyPreviewProfiles: 'Podglądy studiów',
  workProfiles: 'Profile pracy',
  workScheduleImports: 'Importy pracy',
  workScheduleEntries: 'Grafik pracy',
  workCoworkerShifts: 'Współpracownicy',
  dayPlanningProfiles: 'Profile dnia',
  dailyRoutineRules: 'Rutyny',
  dayAttributes: 'Atrybuty dni',
  consistencyAcknowledgements: 'Potwierdzenia',
  availabilityPlans: 'Dyspozycyjność',
  shoppingItems: 'Zakupy',
  expenseCategories: 'Kategorie wydatków',
  receipts: 'Paragony',
  cyclePeriods: 'Cykl',
  cycleJournalEntries: 'Dziennik cyklu',
  changeJournal: 'Historia zmian',
};

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  title: 'Tytuł',
  name: 'Nazwa',
  description: 'Opis',
  date: 'Data',
  startDate: 'Data początku',
  endDate: 'Data końca',
  startDateTime: 'Początek',
  endDateTime: 'Koniec',
  startTime: 'Godzina początku',
  endTime: 'Godzina końca',
  createdAt: 'Utworzono',
  updatedAt: 'Zmieniono',
  capturedAt: 'Zapisano',
  timestamp: 'Czas',
  source: 'Źródło',
  category: 'Kategoria',
  categoryId: 'ID kategorii',
  merchant: 'Sklep',
  totalMinor: 'Kwota razem',
  amountMinor: 'Kwota',
  quantity: 'Ilość',
  sortOrder: 'Kolejność',
  active: 'Aktywne',
  note: 'Notatka',
  address: 'Adres',
  room: 'Sala',
  clinic: 'Klinika',
  locationId: 'ID miejsca',
  label: 'Etykieta',
  type: 'Typ',
  status: 'Status',
  sourceOnly: 'Tylko źródło',
  eventId: 'ID wydarzenia',
  importId: 'ID importu',
  seriesId: 'ID serii',
  seriesKey: 'Klucz serii',
  operationType: 'Operacja',
  entityType: 'Typ elementu',
  entityIds: 'ID elementów',
  reversible: 'Można cofnąć',
  deletedAt: 'Usunięto',
  displayName: 'Nazwa wyświetlana',
  appVersion: 'Wersja aplikacji',
  databaseSchemaVersion: 'Wersja schematu',
};

interface ExcelExportFile {
  fileName: string;
  buffer: ArrayBuffer;
  storeSheetNames: Record<string, string>;
}

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeJson(value: unknown, context: string): string {
  const encoded = JSON.stringify(value);
  const text = encoded === undefined ? String(value) : encoded;
  if (text.length > EXCEL_CELL_TEXT_LIMIT) {
    throw new Error(`Pole „${context}” jest zbyt duże dla pojedynczej komórki Excela. Eksport został przerwany bez utraty danych.`);
  }
  return text;
}

function splitCamelCase(value: string): string {
  return value.replace(/([a-ząćęłńóśźż0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
}

export function excelFieldLabel(key: string): string {
  const known = FIELD_LABELS[key];
  if (known) return known;
  const readable = splitCamelCase(key).trim();
  return readable ? readable.charAt(0).toLocaleUpperCase('pl-PL') + readable.slice(1) : key;
}

export function safeExcelSheetName(input: string, used = new Set<string>()): string {
  const clean = input.replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim() || 'Dane';
  const base = clean.slice(0, 31);
  let candidate = base;
  let counter = 2;
  while (used.has(candidate.toLocaleLowerCase('pl-PL'))) {
    const suffix = ` ${counter}`;
    candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    counter += 1;
  }
  used.add(candidate.toLocaleLowerCase('pl-PL'));
  return candidate;
}

export function excelFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `Inteligentny-Kalendarz-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.xlsx`;
}

function localDateFromKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
}

function dateTimeFromIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function orderedKeys(rows: RecordLike[]): string[] {
  const priority = ['id', 'date', 'title', 'name', 'merchant', 'category', 'categoryId', 'startDateTime', 'endDateTime', 'createdAt', 'updatedAt'];
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
  const keys = [...seen];
  return [
    ...priority.filter((key) => seen.has(key)),
    ...keys.filter((key) => !priority.includes(key)).sort((a, b) => a.localeCompare(b, 'pl')),
  ];
}

function styleHeaderRow(worksheet: Worksheet, rowNumber = 1): void {
  const row = worksheet.getRow(rowNumber);
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentStrong } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: COLORS.accentStrong } } };
  });
}

function finalizeTableSheet(worksheet: Worksheet, headerRow = 1): void {
  styleHeaderRow(worksheet, headerRow);
  worksheet.views = [{ state: 'frozen', ySplit: headerRow }];
  if (worksheet.columnCount > 0 && worksheet.rowCount >= headerRow) {
    worksheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow, column: worksheet.columnCount },
    };
  }
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === headerRow) return;
    row.alignment = { vertical: 'top', wrapText: true };
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FBF8F6' } };
      });
    }
  });
  for (let index = 1; index <= worksheet.columnCount; index += 1) {
    const column = worksheet.getColumn(index);
    let width = Math.max(10, String(column.header ?? '').length + 2);
    column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber === headerRow) return;
      const text = cell.text || '';
      width = Math.max(width, Math.min(42, text.length + 2));
    });
    column.width = Math.min(42, width);
  }
}

function setCellValue(cell: ExcelJS.Cell, key: string, value: unknown): void {
  if (value === null || value === undefined) {
    cell.value = '';
    return;
  }
  if (typeof value === 'number') {
    if (/Minor$/.test(key) && Number.isFinite(value)) {
      cell.value = value / 100;
      cell.numFmt = PLN_FORMAT;
    } else {
      cell.value = value;
    }
    return;
  }
  if (typeof value === 'boolean') {
    cell.value = value ? 'Tak' : 'Nie';
    return;
  }
  if (typeof value === 'string') {
    const localDate = localDateFromKey(value);
    if (localDate && /date/i.test(key)) {
      cell.value = localDate;
      cell.numFmt = DATE_FORMAT;
      return;
    }
    const dateTime = dateTimeFromIso(value);
    if (dateTime && /(At|DateTime|timestamp)$/i.test(key)) {
      cell.value = dateTime;
      cell.numFmt = DATE_TIME_FORMAT;
      return;
    }
    if (value.length > EXCEL_CELL_TEXT_LIMIT) {
      throw new Error(`Pole „${excelFieldLabel(key)}” jest zbyt duże dla pojedynczej komórki Excela. Eksport został przerwany bez utraty danych.`);
    }
    cell.value = value;
    return;
  }
  cell.value = safeJson(value, excelFieldLabel(key));
}

function addGenericStoreSheet(workbook: ExcelJS.Workbook, name: string, items: unknown[]): Worksheet {
  const worksheet = workbook.addWorksheet(name, { properties: { defaultRowHeight: 20 } });
  const rows = items.map((item) => isRecord(item) ? item : { value: item });
  if (!rows.length) {
    worksheet.addRow(['Brak danych']);
    worksheet.getCell('A1').font = { italic: true, color: { argb: COLORS.muted } };
    worksheet.getColumn(1).width = 24;
    return worksheet;
  }
  const keys = orderedKeys(rows);
  worksheet.addRow(keys.map(excelFieldLabel));
  for (const item of rows) {
    const row = worksheet.addRow(new Array(keys.length).fill(''));
    keys.forEach((key, index) => setCellValue(row.getCell(index + 1), key, item[key]));
  }
  finalizeTableSheet(worksheet);
  return worksheet;
}

function asExpenseCategories(items: unknown[]): ExpenseCategory[] {
  return items.filter(isRecord).filter((item) => typeof item.id === 'string' && typeof item.name === 'string') as unknown as ExpenseCategory[];
}

function asReceipts(items: unknown[]): Receipt[] {
  return items.filter(isRecord).filter((item) => typeof item.id === 'string' && Array.isArray(item.items)) as unknown as Receipt[];
}

function extraFields(record: RecordLike, known: readonly string[]): RecordLike {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !known.includes(key)));
}

function addReceiptSheets(workbook: ExcelJS.Workbook, receiptSheetName: string, categoriesSheetName: string, stores: Record<string, unknown[]>, usedNames: Set<string>): void {
  const categories = asExpenseCategories(stores.expenseCategories ?? []);
  const categoryById = new Map(categories.map((category) => [category.id, category.name]));
  const receipts = [...asReceipts(stores.receipts ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const receiptSheet = workbook.addWorksheet(receiptSheetName);
  receiptSheet.addRow(['ID', 'Data', 'Sklep', 'Kwota razem', 'Liczba pozycji', 'Utworzono', 'Zmieniono', 'Dane dodatkowe']);
  for (const receipt of receipts) {
    const row = receiptSheet.addRow(['', '', receipt.merchant, receipt.totalMinor / 100, receipt.items.length, '', '', '']);
    row.getCell(1).value = receipt.id;
    setCellValue(row.getCell(2), 'date', receipt.date);
    row.getCell(4).numFmt = PLN_FORMAT;
    setCellValue(row.getCell(6), 'createdAt', receipt.createdAt);
    setCellValue(row.getCell(7), 'updatedAt', receipt.updatedAt);
    const extras = extraFields(receipt as unknown as RecordLike, ['id', 'date', 'merchant', 'totalMinor', 'items', 'createdAt', 'updatedAt']);
    if (Object.keys(extras).length) row.getCell(8).value = safeJson(extras, `Paragon ${receipt.id} - dane dodatkowe`);
  }
  if (!receipts.length) receiptSheet.addRow(['Brak danych']);
  finalizeTableSheet(receiptSheet);

  const itemSheetName = safeExcelSheetName('Pozycje paragonów', usedNames);
  const itemSheet = workbook.addWorksheet(itemSheetName);
  itemSheet.addRow(['ID paragonu', 'Data', 'Sklep', 'ID pozycji', 'Produkt', 'Kategoria', 'Kwota', 'Dane dodatkowe']);
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      const row = itemSheet.addRow([receipt.id, '', receipt.merchant, item.id, item.name, categoryById.get(item.categoryId) ?? item.categoryId, item.amountMinor / 100, '']);
      setCellValue(row.getCell(2), 'date', receipt.date);
      row.getCell(7).numFmt = PLN_FORMAT;
      const extras = extraFields(item as unknown as RecordLike, ['id', 'name', 'categoryId', 'amountMinor']);
      if (Object.keys(extras).length) row.getCell(8).value = safeJson(extras, `Pozycja ${item.id} - dane dodatkowe`);
    }
  }
  if (itemSheet.rowCount === 1) itemSheet.addRow(['Brak danych']);
  finalizeTableSheet(itemSheet);

  const categorySheet = workbook.addWorksheet(categoriesSheetName);
  categorySheet.addRow(['ID', 'Nazwa', 'Kolejność', 'Utworzono', 'Zmieniono', 'Dane dodatkowe']);
  for (const category of [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))) {
    const row = categorySheet.addRow([category.id, category.name, category.sortOrder, '', '', '']);
    setCellValue(row.getCell(4), 'createdAt', category.createdAt);
    setCellValue(row.getCell(5), 'updatedAt', category.updatedAt);
    const extras = extraFields(category as unknown as RecordLike, ['id', 'name', 'sortOrder', 'createdAt', 'updatedAt']);
    if (Object.keys(extras).length) row.getCell(6).value = safeJson(extras, `Kategoria ${category.id} - dane dodatkowe`);
  }
  if (!categories.length) categorySheet.addRow(['Brak danych']);
  finalizeTableSheet(categorySheet);
}

function addSummarySheet(workbook: ExcelJS.Workbook, document: BackupDocument): void {
  const worksheet = workbook.addWorksheet('Podsumowanie', { properties: { defaultRowHeight: 21 } });
  worksheet.mergeCells('A1:D1');
  worksheet.getCell('A1').value = 'Inteligentny Kalendarz - eksport danych';
  worksheet.getCell('A1').font = { bold: true, size: 18, color: { argb: COLORS.text } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.background } };
  worksheet.getCell('A1').alignment = { vertical: 'middle' };
  worksheet.getRow(1).height = 34;

  const stores = document.data.stores;
  const receipts = asReceipts(stores.receipts ?? []);
  const shoppingItems = stores.shoppingItems ?? [];
  const totalExpenses = receipts.reduce((sum, receipt) => sum + receipt.totalMinor, 0) / 100;
  const exportDate = new Date(document.createdAt);
  const rows: Array<[string, string | number | Date]> = [
    ['Wersja aplikacji', document.appVersion],
    ['Wersja schematu danych', document.databaseSchemaVersion],
    ['Data eksportu', Number.isNaN(exportDate.getTime()) ? document.createdAt : exportDate],
    ['Liczba wydarzeń', stores.events?.length ?? 0],
    ['Liczba miejsc', stores.locations?.length ?? 0],
    ['Liczba zmian pracy', stores.workScheduleEntries?.length ?? 0],
    ['Liczba pozycji listy zakupów', shoppingItems.length],
    ['Liczba paragonów', receipts.length],
    ['Liczba pozycji paragonów', receipts.reduce((sum, receipt) => sum + receipt.items.length, 0)],
    ['Liczba kategorii wydatków', stores.expenseCategories?.length ?? 0],
    ['Wydatki łącznie', totalExpenses],
    ['Liczba wpisów cyklu', stores.cyclePeriods?.length ?? 0],
    ['Liczba wpisów dziennika cyklu', stores.cycleJournalEntries?.length ?? 0],
    ['Liczba kolekcji canonical', Object.keys(stores).length],
  ];
  worksheet.addRow([]);
  worksheet.addRow(['Informacja', 'Wartość']);
  rows.forEach(([label, value]) => worksheet.addRow([label, value]));
  styleHeaderRow(worksheet, 3);
  worksheet.views = [{ state: 'frozen', ySplit: 3 }];
  worksheet.getColumn(1).width = 34;
  worksheet.getColumn(2).width = 28;
  worksheet.getColumn(2).alignment = { vertical: 'top', wrapText: true };
  const dateRow = rows.findIndex(([label]) => label === 'Data eksportu') + 4;
  if (worksheet.getCell(dateRow, 2).value instanceof Date) worksheet.getCell(dateRow, 2).numFmt = DATE_TIME_FORMAT;
  const expenseRow = rows.findIndex(([label]) => label === 'Wydatki łącznie') + 4;
  worksheet.getCell(expenseRow, 2).numFmt = PLN_FORMAT;

  const startStoreRow = worksheet.rowCount + 3;
  worksheet.getCell(startStoreRow, 1).value = 'Zawartość pełnego eksportu danych';
  worksheet.getCell(startStoreRow, 1).font = { bold: true, size: 12, color: { argb: COLORS.text } };
  worksheet.getCell(startStoreRow + 1, 1).value = 'Kolekcja';
  worksheet.getCell(startStoreRow + 1, 2).value = 'Liczba rekordów';
  styleHeaderRow(worksheet, startStoreRow + 1);
  Object.keys(stores).sort((a, b) => (CANONICAL_STORE_SHEET_NAMES[a] ?? a).localeCompare(CANONICAL_STORE_SHEET_NAMES[b] ?? b, 'pl')).forEach((storeName) => {
    worksheet.addRow([CANONICAL_STORE_SHEET_NAMES[storeName] ?? storeName, stores[storeName]?.length ?? 0]);
  });
}

export function canonicalStoreNamesInExcel(document: BackupDocument): string[] {
  return Object.keys(document.data.stores).sort();
}

export async function createExcelExportFile(document: BackupDocument, now = new Date()): Promise<ExcelExportFile> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Inteligentny Kalendarz';
  workbook.title = 'Eksport danych Inteligentnego Kalendarza';
  workbook.subject = 'Lokalny eksport danych użytkownika';
  workbook.created = now;
  workbook.modified = now;

  addSummarySheet(workbook, document);

  const usedNames = new Set<string>(['podsumowanie']);
  const storeSheetNames: Record<string, string> = {};
  for (const storeName of Object.keys(document.data.stores)) {
    storeSheetNames[storeName] = safeExcelSheetName(CANONICAL_STORE_SHEET_NAMES[storeName] ?? splitCamelCase(storeName), usedNames);
  }

  if (storeSheetNames.receipts && storeSheetNames.expenseCategories) {
    addReceiptSheets(workbook, storeSheetNames.receipts, storeSheetNames.expenseCategories, document.data.stores, usedNames);
  }

  for (const storeName of Object.keys(document.data.stores).sort()) {
    if (storeName === 'receipts' || storeName === 'expenseCategories') continue;
    const sheetName = storeSheetNames[storeName];
    if (!sheetName) continue;
    addGenericStoreSheet(workbook, sheetName, document.data.stores[storeName] ?? []);
  }

  workbook.eachSheet((worksheet) => {
    worksheet.properties.defaultRowHeight = 20;
    worksheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  });

  const generated = await workbook.xlsx.writeBuffer();
  const bytes = generated instanceof ArrayBuffer
    ? generated
    : Uint8Array.from(generated as unknown as ArrayLike<number>).buffer as ArrayBuffer;
  return { fileName: excelFileName(now), buffer: bytes, storeSheetNames };
}

export function downloadExcelFile(file: ExcelExportFile): void {
  const blob = new Blob([file.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
