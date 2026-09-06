import { describe, expect, it } from 'vitest';
import { detectSpreadsheetFormat, readSpreadsheetFile } from '../imports/xlsx/spreadsheet-reader';

function fakeFile(name: string, header: number[]): File {
  return new File([new Uint8Array(header)], name);
}

describe('Excel source format detection', () => {
  it('rozpoznaje prawdziwy nagłówek OLE/CFB jako XLS', async () => {
    const file = fakeFile('plan.xls', [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0]);
    await expect(detectSpreadsheetFormat(file)).resolves.toBe('XLS');
  });

  it('rozpoznaje kontener ZIP jako XLSX', async () => {
    const file = fakeFile('plan.xlsx', [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    await expect(detectSpreadsheetFormat(file)).resolves.toBe('XLSX');
  });

  it('odrzuca plik, którego zawartość nie jest rozpoznawalnym skoroszytem', async () => {
    const file = fakeFile('plan.xlsx', [0x54, 0x45, 0x58, 0x54, 0, 0, 0, 0]);
    await expect(detectSpreadsheetFormat(file)).rejects.toThrow(/rozpoznawalnym skoroszytem Excel/i);
  });

  it('odrzuca zmianę samego rozszerzenia XLS na XLSX', async () => {
    const file = fakeFile('plan.xlsx', [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0]);
    await expect(readSpreadsheetFile(file)).rejects.toThrow(/zawartość pliku jest w formacie \.xls/i);
  });

  it('odrzuca zmianę samego rozszerzenia XLSX na XLS', async () => {
    const file = fakeFile('plan.xls', [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    await expect(readSpreadsheetFile(file)).rejects.toThrow(/zawartość pliku jest w formacie \.xlsx/i);
  });
});
