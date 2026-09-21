import { describe, expect, it } from 'vitest';
import type { Receipt, ReceiptDraft } from '../shopping/expenses.types';
import { createReceiptSourceFingerprint } from '../shopping/receipt-ocr/receipt-source-fingerprint';
import { findReceiptDuplicateMatch } from '../shopping/receipt-ocr/receipt-duplicate';

const SOURCE_A = `sha256:${'a'.repeat(64)}`;
const SOURCE_B = `sha256:${'b'.repeat(64)}`;

function draft(overrides: Partial<ReceiptDraft> = {}): ReceiptDraft {
  return {
    merchant: 'Sklep Testowy',
    date: '2026-09-19',
    source: 'receipt',
    items: [
      { name: 'Produkt A', categoryId: 'food', amountMinor: 499 },
      { name: 'Produkt B', categoryId: 'food', amountMinor: 799 },
    ],
    ...overrides,
  };
}

function saved(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: 'receipt-1',
    merchant: 'Sklep Testowy',
    date: '2026-09-19',
    source: 'receipt',
    items: [
      { id: 'a', name: 'Produkt A', categoryId: 'food', amountMinor: 499 },
      { id: 'b', name: 'Produkt B', categoryId: 'food', amountMinor: 799 },
    ],
    totalMinor: 1298,
    createdAt: '2026-09-19T12:00:00.000Z',
    updatedAt: '2026-09-19T12:00:00.000Z',
    ...overrides,
  };
}

describe('1.2.0 Build156 scanned receipt source idempotency', () => {
  it('hard-classifies only the same source bytes as exact', () => {
    const match = findReceiptDuplicateMatch(draft({ sourceFingerprint: SOURCE_A }), [saved({ sourceFingerprint: SOURCE_A })]);
    expect(match?.confidence).toBe('exact');
    expect(match?.reason).toBe('same-source');
  });

  it('keeps content-identical receipts with different source hashes as likely, not exact', () => {
    const match = findReceiptDuplicateMatch(draft({ sourceFingerprint: SOURCE_B }), [saved({ sourceFingerprint: SOURCE_A })]);
    expect(match?.confidence).toBe('likely');
    expect(match?.reason).toBe('same-items');
  });

  it('does not require merchant/date equality when the exact source file hash already matches', () => {
    const match = findReceiptDuplicateMatch(
      draft({ merchant: 'OCR po korekcie', date: '2026-09-20', sourceFingerprint: SOURCE_A }),
      [saved({ merchant: 'Wcześniejsza nazwa', date: '2026-09-19', sourceFingerprint: SOURCE_A })],
    );
    expect(match?.confidence).toBe('exact');
    expect(match?.reason).toBe('same-source');
  });

  it('computes a stable SHA-256 fingerprint from source bytes', async () => {
    const first = await createReceiptSourceFingerprint(new Blob(['ten sam paragon'], { type: 'image/png' }));
    const second = await createReceiptSourceFingerprint(new Blob(['ten sam paragon'], { type: 'application/pdf' }));
    const different = await createReceiptSourceFingerprint(new Blob(['inny paragon'], { type: 'image/png' }));
    expect(first).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(second).toBe(first);
    expect(different).not.toBe(first);
  });
});
