import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { readXlsxFile } from '../imports/xlsx/xlsx-reader';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('xlsx reader date normalization', () => {
  it('zachowuje datę Excela jako stabilny ISO dateValue dla adapterów planu', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('PLAN');
    sheet.getCell('A1').value = 45937;
    sheet.getCell('A1').numFmt = 'dd.mm.yyyy';

    const buffer = await workbook.xlsx.writeBuffer();
    const file = new File([buffer as BlobPart], 'plan-date.xlsx', { type: XLSX_MIME });
    const snapshot = await readXlsxFile(file);
    const value = snapshot.sheets[0]?.cells.find((cell) => cell.address === 'A1');

    expect(value).toMatchObject({ valueType: 'date', dateValue: '2025-10-07' });
  });
  it.each([
    [1, '1900-01-01'],
    [59, '1900-02-28'],
    [61, '1900-03-01'],
  ])('normalizuje serial Excela 1900 %i do %s bez historycznego przesunięcia', async (serial, expectedDate) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('PLAN');
    sheet.getCell('A1').value = serial;
    sheet.getCell('A1').numFmt = 'dd.mm.yyyy';

    const buffer = await workbook.xlsx.writeBuffer();
    const file = new File([buffer as BlobPart], `plan-date-1900-${serial}.xlsx`, { type: XLSX_MIME });
    const snapshot = await readXlsxFile(file);
    const value = snapshot.sheets[0]?.cells.find((cell) => cell.address === 'A1');

    expect(value).toMatchObject({ valueType: 'date', dateValue: expectedDate });
  });

});
