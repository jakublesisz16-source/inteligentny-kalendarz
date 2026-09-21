import { describe, expect, it } from 'vitest';
import { isReceiptJsonFile, MAX_RECEIPT_JSON_BYTES, validateReceiptScanFile } from '../shopping/receipt-ocr/receipt-source';

describe('1.2.0 Build159 structured JSON source validation', () => {
  it('recognizes JSON by MIME or extension without affecting camera capture', () => {
    expect(isReceiptJsonFile({ name: 'receipt.json', type: '' })).toBe(true);
    expect(isReceiptJsonFile({ name: 'receipt.bin', type: 'application/json' })).toBe(true);
    expect(isReceiptJsonFile({ name: 'receipt.pdf', type: 'application/pdf' })).toBe(false);
  });

  it('accepts a small JSON receipt and rejects oversized JSON before parsing', () => {
    expect(() => validateReceiptScanFile(new File(['{}'], 'receipt.json', { type: 'application/json' }))).not.toThrow();
    const oversized = new File([new Uint8Array(MAX_RECEIPT_JSON_BYTES + 1)], 'receipt.json', { type: 'application/json' });
    expect(() => validateReceiptScanFile(oversized)).toThrow(/4 MB/u);
  });
});
