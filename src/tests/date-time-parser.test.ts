import { describe, expect, it } from 'vitest';
import { detectAcademicYear, detectTerm, parseDateExpression } from '../imports/xlsx/date-parser';
import { inferGridIntervalMinutes, parseTimeRange } from '../imports/xlsx/time-parser';

const academicYear = { firstYear: 2025, secondYear: 2026 };

describe('date parser hardening', () => {
  it.each([
    ['16.02.', ['2026-02-16']],
    ['16.02', ['2026-02-16']],
    ['16/02', ['2026-02-16']],
    ['16.02.2026', ['2026-02-16']],
    ['16-02-2026', ['2026-02-16']],
  ])('parsuje %s', (input, expected) => {
    expect(parseDateExpression(input, academicYear, 'PONIEDZIAŁEK').dates).toEqual(expected);
  });

  it('parsuje listy oddzielone przecinkiem, średnikiem i nową linią', () => {
    expect(parseDateExpression('08.05., 15.05.;\n22.05.', academicYear, 'PIĄTEK').dates).toEqual([
      '2026-05-08', '2026-05-15', '2026-05-22',
    ]);
  });

  it('rozwija zakres tygodniowo według dnia planu', () => {
    expect(parseDateExpression('16.02. - 02.03.', academicYear, 'PONIEDZIAŁEK').dates).toEqual([
      '2026-02-16', '2026-02-23', '2026-03-02',
    ]);
  });

  it('obsługuje rzeczywistą datę Excela przekazaną przez snapshot', () => {
    expect(parseDateExpression('', null, 'PONIEDZIAŁEK', '2026-02-16').dates).toEqual(['2026-02-16']);
  });

  it('nie traktuje pojedynczych numerów jako dat', () => {
    expect(parseDateExpression('sala 204', academicYear).dates).toEqual([]);
    expect(parseDateExpression('grupa 13', academicYear).dates).toEqual([]);
    expect(parseDateExpression('budynek 27', academicYear).dates).toEqual([]);
  });

  it('nie zgaduje roku bez kontekstu dla daty bez roku', () => {
    const result = parseDateExpression('16.02.', null, 'PONIEDZIAŁEK');
    expect(result.dates).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('wykrywa rok akademicki z ukośnikiem lub myślnikiem', () => {
    expect(detectAcademicYear(['rok akademicki 2025/2026'])).toEqual(academicYear);
    expect(detectAcademicYear(['2025-2026'])).toEqual(academicYear);
  });

  it('wykrywa semestr z kilku wariantów', () => {
    expect(detectTerm(['Semestr letni'])).toBe('semestr letni');
    expect(detectTerm(['LATO 2025/2026'])).toBe('semestr letni');
    expect(detectTerm(['semestr zimowy'])).toBe('semestr zimowy');
  });
});

describe('time parser hardening', () => {
  it.each([
    '7.00 - 7.15',
    '07.00 - 07.15',
    '7:00 - 7:15',
    '07:00-07:15',
    '7.00-7.15',
  ])('normalizuje %s', (input) => {
    expect(parseTimeRange(input)).toEqual({ start: '07:00', end: '07:15' });
  });

  it('wyciąga precyzyjną godzinę z wpisu grupy', () => {
    expect(parseTimeRange('grupa 5 / 8.15 - 9.50')).toEqual({ start: '08:15', end: '09:50' });
  });

  it('wykrywa dominujący interwał bez założenia 15 minut', () => {
    expect(inferGridIntervalMinutes([
      { start: '08:00', end: '08:30' },
      { start: '08:30', end: '09:00' },
      { start: '09:00', end: '09:30' },
    ])).toBe(30);
  });
});
