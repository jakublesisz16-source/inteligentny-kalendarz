import { describe, expect, it } from 'vitest';
import { MAX_RECEIPT_IMAGE_BYTES, resolveReceiptImageType, SUPPORTED_RECEIPT_IMAGE_TYPES, validateReceiptImageFile } from '../shopping/receipt-ocr/image-preprocess';

describe('1.1.0-dev.3 receipt image validation', () => {
  it('documents JPEG, PNG and WEBP as supported input', () => {
    expect(SUPPORTED_RECEIPT_IMAGE_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });


  it('accepts JPEG aliases and supported extensions when the picker omits a useful MIME type', () => {
    expect(resolveReceiptImageType({ name: 'receipt.JPG', type: '' })).toBe('image/jpeg');
    expect(resolveReceiptImageType({ name: 'receipt.jpeg', type: 'application/octet-stream' })).toBe('image/jpeg');
    expect(resolveReceiptImageType({ name: 'receipt.jpg', type: 'image/jpg' })).toBe('image/jpeg');
    expect(resolveReceiptImageType({ name: 'receipt.jpg', type: 'image/pjpeg' })).toBe('image/jpeg');
    expect(resolveReceiptImageType({ name: 'receipt.png', type: 'image/png' })).toBe('image/png');
    expect(resolveReceiptImageType({ name: 'receipt.webp', type: 'image/webp' })).toBe('image/webp');
    expect(() => validateReceiptImageFile(new File(['abc'], 'receipt.JPG', { type: '' }))).not.toThrow();
  });

  it('does not use a supported extension to override an explicitly unsupported image MIME', () => {
    expect(resolveReceiptImageType({ name: 'receipt.jpg', type: 'image/heic' })).toBeUndefined();
    expect(() => validateReceiptImageFile(new File(['abc'], 'receipt.jpg', { type: 'image/heic' }))).toThrow('JPEG, PNG lub WEBP');
  });

  it('accepts a normal local image and rejects unsupported/oversized input before OCR', () => {
    expect(() => validateReceiptImageFile(new File(['abc'], 'receipt.jpg', { type: 'image/jpeg' }))).not.toThrow();
    expect(() => validateReceiptImageFile(new File(['abc'], 'receipt.heic', { type: 'image/heic' }))).toThrow('JPEG, PNG lub WEBP');
    const oversized = { type: 'image/jpeg', size: MAX_RECEIPT_IMAGE_BYTES + 1 } as File;
    expect(() => validateReceiptImageFile(oversized)).toThrow('32 MB');
  });
});
