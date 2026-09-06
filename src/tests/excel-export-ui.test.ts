import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.1.0-dev.2 FIX4 Excel export UI contract', () => {
  it('adds local Excel export next to canonical JSON transfer without adding Excel import', () => {
    const panel = source('../data-transfer/DataTransferPanel.tsx');
    expect(panel).toContain('Eksportuj do Excela');
    expect(panel).toContain('createCanonicalDataTransferDocument');
    expect(panel).toContain("from './excel-export'");
    expect(panel).toContain('nie można go importować z powrotem');
    expect(panel).not.toContain('Importuj Excel');
  });

  it('keeps Excel generation local and maps every canonical store through a common adapter', () => {
    const excel = source('../data-transfer/excel-export.ts');
    expect(excel).toContain('CANONICAL_STORE_SHEET_NAMES');
    expect(excel).toContain("workbook.addWorksheet('Podsumowanie'");
    expect(excel).toContain("safeExcelSheetName('Pozycje paragonów'");
    expect(excel).toContain('worksheet.autoFilter');
    expect(excel).toContain("state: 'frozen'");
    expect(excel).toContain('PLN_FORMAT');
    expect(excel).toContain('EXCEL_CELL_TEXT_LIMIT');
    expect(excel).not.toContain('fetch(');
    expect(excel).not.toContain('XMLHttpRequest');
  });
});
