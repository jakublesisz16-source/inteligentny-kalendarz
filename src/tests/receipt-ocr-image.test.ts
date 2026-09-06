import { describe, expect, it } from 'vitest';
import { MAX_RECEIPT_IMAGE_BYTES, SUPPORTED_RECEIPT_IMAGE_TYPES, validateReceiptImageFile } from '../shopping/receipt-ocr/image-preprocess';

describe('1.1.0-dev.3 receipt image validation', () => {
  it('documents JPEG, PNG and WEBP as supported input', () => {
    expect(SUPPORTED_RECEIPT_IMAGE_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  it('accepts a normal local image and rejects unsupported/oversized input before OCR', () => {
    expect(() => validateReceiptImageFile(new File(['abc'], 'receipt.jpg', { type: 'image/jpeg' }))).not.toThrow();
    expect(() => validateReceiptImageFile(new File(['abc'], 'receipt.heic', { type: 'image/heic' }))).toThrow('JPEG, PNG lub WEBP');
    const oversized = { type: 'image/jpeg', size: MAX_RECEIPT_IMAGE_BYTES + 1 } as File;
    expect(() => validateReceiptImageFile(oversized)).toThrow('32 MB');
  });
});
