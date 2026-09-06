import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createExcelExportFile } from '../data-transfer/excel-export';
import { createCanonicalDataTransferDocument, createReceipt, deleteDatabaseForTests, listExpenseCategories } from '../storage/database';
import type { ReceiptReviewDraft } from '../shopping/receipt-ocr/receipt-ocr.types';
import { receiptReviewToDraft } from '../shopping/receipt-ocr/receipt-review.model';

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('1.1.0-dev.3 reviewed OCR persistence integration', () => {
  it('uses normal createReceipt and automatically appears in canonical JSON data and Excel export', async () => {
    const category = (await listExpenseCategories())[0]!;
    const review: ReceiptReviewDraft = {
      merchant: 'Sklep testowy', merchantConfidence: 'high', date: '2026-08-16', dateConfidence: 'high',
      declaredTotalMinor: 649, parserWarnings: [], adjustments: [],
      items: [{ localId: 'ocr-1', name: 'Produkt testowy', categoryId: category.id, amountText: '6,49', confidence: 'high', warnings: [] }],
    };

    const created = await createReceipt(receiptReviewToDraft(review));
    expect(created.totalMinor).toBe(649);

    const canonical = await createCanonicalDataTransferDocument();
    const stored = (canonical.data.stores.receipts as typeof created[]).find((receipt) => receipt.id === created.id);
    expect(stored).toMatchObject({ merchant: 'Sklep testowy', totalMinor: 649 });
    expect(JSON.stringify(stored)).not.toContain('confidence');
    expect(JSON.stringify(stored)).not.toContain('rawText');

    const excel = await createExcelExportFile(canonical, new Date(2026, 7, 16, 12, 0));
    expect(excel.buffer.byteLength).toBeGreaterThan(1000);
    expect(excel.storeSheetNames.receipts).toBeTruthy();
  });
});
