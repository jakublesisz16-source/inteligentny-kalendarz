export const MAX_WORK_PDF_FILE_BYTES = 32 * 1024 * 1024;

function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

export async function validateWorkPdfFile(file: File): Promise<void> {
  if (!file.name.toLocaleLowerCase('en-US').endsWith('.pdf')) {
    throw new Error('Wybierz plik w formacie .pdf.');
  }
  if (file.size <= 0) {
    throw new Error('Plik PDF jest pusty.');
  }
  if (file.size > MAX_WORK_PDF_FILE_BYTES) {
    throw new Error('Plik PDF jest zbyt duży. Maksymalny obsługiwany rozmiar to 32 MB.');
  }

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (!hasPdfSignature(header)) {
    throw new Error('Wybrany plik nie jest prawidłowym dokumentem PDF.');
  }
}
