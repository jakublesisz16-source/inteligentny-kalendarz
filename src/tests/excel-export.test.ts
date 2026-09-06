import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { BackupDocument } from '../safety/safety.types';
import {
  CANONICAL_STORE_SHEET_NAMES,
  canonicalStoreNamesInExcel,
  createExcelExportFile,
  excelFileName,
  safeExcelSheetName,
} from '../data-transfer/excel-export';

const canonicalStores = Object.fromEntries(Object.keys(CANONICAL_STORE_SHEET_NAMES).map((name) => [name, [] as unknown[]]));

function documentWithData(): BackupDocument {
  const stores: Record<string, unknown[]> = structuredClone(canonicalStores);
  stores.events = [{ id: 'event-1', title: 'Wizyta Łódź', startDateTime: '2026-08-16T09:00', endDateTime: '2026-08-16T10:00', category: 'OTHER' }];
  stores.shoppingItems = [{ id: 'shop-1', name: 'Żółty ser', quantity: '2', purchased: false }];
  stores.expenseCategories = [{ id: 'expense-category-food', name: 'Jedzenie', sortOrder: 0, createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z' }];
  stores.receipts = [{
    id: 'receipt-1', date: '2026-08-16', merchant: 'Biedronka', totalMinor: 1234,
    items: [{ id: 'item-1', name: 'Mleko Łaciate', categoryId: 'expense-category-food', amountMinor: 1234 }],
    createdAt: '2026-08-16T10:00:00.000Z', updatedAt: '2026-08-16T10:00:00.000Z',
  }];
  stores.cycleJournalEntries = [{ id: 'cycle-journal-1', date: '2026-08-16', note: 'Zażółć gęślą jaźń' }];
  return {
    format: 'inteligentny-kalendarz-backup',
    backupVersion: 1,
    appVersion: '1.1.0-dev.2',
    databaseSchemaVersion: 13,
    createdAt: '2026-08-16T00:11:00.000Z',
    checksum: 'test-checksum',
    data: {
      format: 'inteligentny-kalendarz-snapshot',
      snapshotVersion: 1,
      appVersion: '1.1.0-dev.2',
      databaseSchemaVersion: 13,
      capturedAt: '2026-08-16T00:11:00.000Z',
      stores,
    },
  };
}

async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

describe('1.1.0-dev.2 FIX4 Excel export', () => {
  it('generates a readable XLSX with summary, receipts and numeric PLN values', async () => {
    const document = documentWithData();
    const file = await createExcelExportFile(document, new Date(2026, 7, 16, 0, 11));
    expect(file.fileName).toBe('Inteligentny-Kalendarz-2026-08-16_00-11.xlsx');
    expect(new Uint8Array(file.buffer).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));

    const workbook = await loadWorkbook(file.buffer);
    expect(workbook.getWorksheet('Podsumowanie')).toBeTruthy();
    const receipts = workbook.getWorksheet(file.storeSheetNames.receipts!);
    const items = workbook.getWorksheet('Pozycje paragonów');
    expect(receipts).toBeTruthy();
    expect(items).toBeTruthy();
    expect(receipts!.getCell('C2').value).toBe('Biedronka');
    expect(receipts!.getCell('D2').value).toBe(12.34);
    expect(receipts!.getCell('D2').numFmt).toContain('zł');
    expect(items!.getCell('E2').value).toBe('Mleko Łaciate');
    expect(items!.getCell('G2').value).toBe(12.34);
    expect(workbook.getWorksheet(file.storeSheetNames.events!)!.getCell('B2').text).toContain('Wizyta Łódź');
  });

  it('covers every top-level canonical collection with a worksheet and preserves Polish text', async () => {
    const document = documentWithData();
    const file = await createExcelExportFile(document, new Date(2026, 7, 16, 12, 5));
    const workbook = await loadWorkbook(file.buffer);
    expect(canonicalStoreNamesInExcel(document)).toEqual(Object.keys(document.data.stores).sort());
    for (const storeName of Object.keys(document.data.stores)) {
      const sheetName = file.storeSheetNames[storeName];
      expect(sheetName, storeName).toBeTruthy();
      expect(workbook.getWorksheet(sheetName!), storeName).toBeTruthy();
    }
    const cycleSheet = workbook.getWorksheet(file.storeSheetNames.cycleJournalEntries!);
    expect(cycleSheet!.getCell('C2').text).toBe('Zażółć gęślą jaźń');
  });

  it('keeps a future canonical collection instead of silently dropping it', async () => {
    const document = documentWithData();
    document.data.stores.futureLocalData = [{ id: 'future-1', note: 'Nowe dane' }];
    const file = await createExcelExportFile(document, new Date(2026, 7, 16, 12, 6));
    const workbook = await loadWorkbook(file.buffer);
    expect(file.storeSheetNames.futureLocalData).toBeTruthy();
    expect(workbook.getWorksheet(file.storeSheetNames.futureLocalData!)).toBeTruthy();
  });

  it('fails explicitly instead of truncating a value beyond the Excel cell limit', async () => {
    const document = documentWithData();
    document.data.stores.events = [{ id: 'large-1', description: 'x'.repeat(33_000) }];
    await expect(createExcelExportFile(document, new Date(2026, 7, 16, 12, 7))).rejects.toThrow('zbyt duże');
  });

  it('creates a valid workbook for empty canonical stores', async () => {
    const document = documentWithData();
    for (const key of Object.keys(document.data.stores)) document.data.stores[key] = [];
    const file = await createExcelExportFile(document, new Date(2026, 0, 2, 3, 4));
    const workbook = await loadWorkbook(file.buffer);
    expect(workbook.getWorksheet('Podsumowanie')).toBeTruthy();
    expect(workbook.worksheets.length).toBe(Object.keys(document.data.stores).length + 2); // summary + receipt-items
  });

  it('sanitizes Excel sheet names and Windows-safe filenames deterministically', () => {
    const used = new Set<string>();
    const first = safeExcelSheetName('Bardzo długa/nazwa:arkusza?z*nielegalnymi[znakami] i końcówką', used);
    const second = safeExcelSheetName('Bardzo długa/nazwa:arkusza?z*nielegalnymi[znakami] i końcówką', used);
    expect(first.length).toBeLessThanOrEqual(31);
    expect(second.length).toBeLessThanOrEqual(31);
    expect(second).not.toBe(first);
    expect(first).not.toMatch(/[\\/?*\[\]:]/);
    expect(excelFileName(new Date(2026, 7, 16, 9, 7))).toBe('Inteligentny-Kalendarz-2026-08-16_09-07.xlsx');
  });
});
