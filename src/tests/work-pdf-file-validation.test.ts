import { describe, expect, it } from 'vitest';
import { MAX_WORK_PDF_FILE_BYTES, validateWorkPdfFile } from '../imports/pdf/work-pdf-file';

function pdfFile(name = 'grafik.pdf', body = '%PDF-1.7\n'): File {
  return new File([body], name, { type: 'application/pdf' });
}

describe('Work PDF file validation', () => {
  it('accepts a bounded PDF with a real PDF signature', async () => {
    await expect(validateWorkPdfFile(pdfFile())).resolves.toBeUndefined();
  });

  it('rejects a renamed non-PDF before the full file is read', async () => {
    const fake = pdfFile('grafik.pdf', 'NOT-A-PDF');
    await expect(validateWorkPdfFile(fake)).rejects.toThrow(/prawidłowym dokumentem PDF/iu);
  });

  it('rejects an oversized work PDF before materializing it in memory', async () => {
    let sliceCalled = false;
    const oversized = {
      name: 'grafik.pdf',
      size: MAX_WORK_PDF_FILE_BYTES + 1,
      slice() {
        sliceCalled = true;
        throw new Error('slice should not be called');
      },
    } as unknown as File;
    await expect(validateWorkPdfFile(oversized)).rejects.toThrow(/32 MB/iu);
    expect(sliceCalled).toBe(false);
  });

  it('rejects a non-PDF filename before reading even the header', async () => {
    let sliceCalled = false;
    const wrongExtension = {
      name: 'grafik.txt',
      size: 100,
      slice() {
        sliceCalled = true;
        throw new Error('slice should not be called');
      },
    } as unknown as File;
    await expect(validateWorkPdfFile(wrongExtension)).rejects.toThrow(/formacie.*pdf/iu);
    expect(sliceCalled).toBe(false);
  });
});
