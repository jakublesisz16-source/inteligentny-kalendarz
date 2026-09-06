import 'fake-indexeddb/auto';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createExcelExportFile } from '../data-transfer/excel-export';
import {
  createBackupFile,
  createCanonicalDataTransferDocument,
  createReceipt,
  deleteDatabaseForTests,
  inspectBackupText,
  listExpenseCategories,
  listReceipts,
  resetDatabaseConnectionForTests,
  restoreBackup,
} from '../storage/database';
import type { ReceiptReviewDraft } from '../shopping/receipt-ocr/receipt-ocr.types';
import { receiptReviewToDraft } from '../shopping/receipt-ocr/receipt-review.model';

beforeEach(async () => { await deleteDatabaseForTests(); });

async function buildReview(): Promise<ReceiptReviewDraft> {
  const categories = await listExpenseCategories();
  const other = categories.find((category) => category.name === 'Inne') ?? categories[0]!;
  const deposit = categories.find((category) => category.name === 'Kaucja / opakowania zwrotne') ?? other;
  return {
    merchant: 'Sklep Testowy',
    merchantConfidence: 'high',
    date: '2026-08-18',
    dateConfidence: 'high',
    declaredTotalMinor: 709,
    parserWarnings: [],
    adjustments: [],
    items: [
      { localId: 'discounted', name: 'Produkt promocyjny', categoryId: other.id, amountText: '4,49', baseAmountMinor: 899, discountMinor: 450, confidence: 'high', warnings: [] },
      { localId: 'weighted', name: 'Produkt ważony', categoryId: other.id, amountText: '1,10', confidence: 'medium', warnings: ['Kwota potwierdzona matematycznie.'] },
      { localId: 'deposit', name: 'Opakowanie zwrotne', categoryId: deposit.id, amountText: '1,50', confidence: 'high', warnings: [] },
    ],
  };
}

async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

describe('DEV3-B025 final receipt save, persistence and transfer gate', () => {
  it('persists final item amounts only and survives a database connection restart', async () => {
    const review = await buildReview();
    const created = await createReceipt(receiptReviewToDraft(review));
    expect(created.totalMinor).toBe(709);
    expect(created.items.map((item) => item.amountMinor)).toEqual([449, 110, 150]);

    resetDatabaseConnectionForTests();
    const afterRestart = await listReceipts();
    expect(afterRestart).toHaveLength(1);
    expect(afterRestart[0]?.items.map((item) => item.amountMinor)).toEqual([449, 110, 150]);
  });

  it('round-trips the saved receipt through JSON backup/restore without transient OCR fields', async () => {
    const review = await buildReview();
    const original = await createReceipt(receiptReviewToDraft(review));
    const backup = await createBackupFile();
    const inspection = await inspectBackupText(backup.text);

    for (const forbidden of ['diagnosticOcrText', 'sourceQuality', 'financialScore', 'receiptImage', 'pageText', 'ocrConfidence']) {
      expect(backup.text, forbidden).not.toContain(forbidden);
    }

    const categories = await listExpenseCategories();
    await createReceipt({ merchant: 'Stan tymczasowy', date: '2026-08-18', items: [{ name: 'Tymczasowy', categoryId: categories[0]!.id, amountMinor: 999 }] });
    expect(await listReceipts()).toHaveLength(2);

    await restoreBackup(inspection.document);
    const restored = await listReceipts();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.id).toBe(original.id);
    expect(restored[0]?.items.map((item) => item.amountMinor)).toEqual([449, 110, 150]);
  });

  it('exports final persisted amounts and the deposit category to Excel without OCR diagnostics', async () => {
    await createReceipt(receiptReviewToDraft(await buildReview()));
    const canonical = await createCanonicalDataTransferDocument();
    const file = await createExcelExportFile(canonical, new Date(2026, 7, 18, 12, 0));
    const workbook = await loadWorkbook(file.buffer);
    const items = workbook.getWorksheet('Pozycje paragonów');
    expect(items).toBeTruthy();

    const rows = [2, 3, 4].map((row) => ({
      product: items!.getCell(`E${row}`).text,
      category: items!.getCell(`F${row}`).text,
      amount: items!.getCell(`G${row}`).value,
    }));
    expect(rows.map((row) => row.amount)).toEqual([4.49, 1.1, 1.5]);
    expect(rows.some((row) => row.category === 'Kaucja / opakowania zwrotne')).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('OCR');
  });
});
