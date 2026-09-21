import { MAX_RECEIPT_IMAGE_BYTES, ReceiptImageError, validateReceiptImageFile } from './image-preprocess';

export const SUPPORTED_RECEIPT_PDF_TYPE = 'application/pdf';
export const SUPPORTED_RECEIPT_JSON_TYPE = 'application/json';
export const MAX_RECEIPT_PDF_BYTES = MAX_RECEIPT_IMAGE_BYTES;
export const MAX_RECEIPT_JSON_BYTES = 4 * 1024 * 1024;

export function isReceiptPdfFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type.toLocaleLowerCase('en-US') === SUPPORTED_RECEIPT_PDF_TYPE
    || file.name.toLocaleLowerCase('en-US').endsWith('.pdf');
}

export function isReceiptJsonFile(file: Pick<File, 'name' | 'type'>): boolean {
  const type = file.type.toLocaleLowerCase('en-US');
  return type === SUPPORTED_RECEIPT_JSON_TYPE
    || type === 'text/json'
    || file.name.toLocaleLowerCase('en-US').endsWith('.json');
}

export function validateReceiptScanFile(file: File): void {
  if (!file) throw new ReceiptImageError('Nie wybrano pliku paragonu.');
  if (isReceiptPdfFile(file)) {
    if (file.size > MAX_RECEIPT_PDF_BYTES) {
      throw new ReceiptImageError('PDF jest zbyt duży. Maksymalny rozmiar pliku to 32 MB.');
    }
    return;
  }
  if (isReceiptJsonFile(file)) {
    if (file.size > MAX_RECEIPT_JSON_BYTES) {
      throw new ReceiptImageError('JSON paragonu jest zbyt duży. Maksymalny rozmiar pliku to 4 MB.');
    }
    return;
  }
  validateReceiptImageFile(file);
}
