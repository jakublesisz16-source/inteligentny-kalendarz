import { describe, expect, it } from 'vitest';
import type { PdfDocumentSnapshot, PdfTextItemSnapshot } from '../imports/pdf/pdf-reader';
import { retailRosterV1Adapter } from '../imports/pdf/adapters/retail-roster-v1.adapter';
import { employeeForProfile } from '../work/work.service';

function item(text: string, x: number, y: number, width = 18): PdfTextItemSnapshot { return { text, x, y, width, height: 10 }; }

function fixture(): PdfDocumentSnapshot {
  const items: PdfTextItemSnapshot[] = [
    item('Miesiąc: sierpień 2026', 20, 20, 140), item('Imię i nazwisko', 20, 40, 90), item('dzień m-ca', 20, 100, 55),
    item('ANNA', 105, 75, 30), item('TESTOWA', 130, 75, 48), item('BEATA', 225, 75, 35), item('TESTOWA', 255, 75, 48),
    item('od', 110, 100), item('do', 150, 100), item('suma', 185, 100, 28),
    item('od', 230, 100), item('do', 270, 100), item('suma', 305, 100, 28),
    item('01', 20, 120), item('10:00', 110, 120), item('18:00', 150, 120), item('12:00', 230, 120), item('16:00', 270, 120),
    item('02', 20, 140), item('16:00', 110, 140), item('18:00', 150, 140), item('10:00', 230, 140), item('18:00', 270, 140),
    item('10:00', 185, 170), item('12:00', 305, 170),
  ];
  return { pageCount: 1, pages: [{ pageNumber: 1, width: 500, height: 700, items }], fullText: items.map((x) => x.text).join(' ') };
}

describe('retail roster adapter', () => {
  it('wyciąga tylko strukturalne zmiany i potrafi znaleźć właściwy profil', () => {
    const parsed = retailRosterV1Adapter.parse(fixture());
    const anna = employeeForProfile(parsed.employees, 'Anna Testowa');
    expect(parsed.periodStart).toBe('2026-08-01');
    expect(parsed.diagnostics.schedulePages).toEqual([1]);
    expect(anna?.shifts).toHaveLength(2);
    expect(anna?.shifts.reduce((sum, shift) => sum + shift.minutes, 0)).toBe(600);
    expect(anna?.sourceReportedMinutes).toBe(600);
  });
});
