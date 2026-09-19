import { describe, expect, it } from 'vitest';
import { canonicalizeStudyGroupSelection, groupSetsIntersect, normalizeGroupText, normalizeStudyGroupSelectionForAvailableGroups, studyGroupCompactLabel, studyGroupDisplayLabel } from '../imports/xlsx/group-normalizer';

describe('normalizeGroupText hardening', () => {
  const cases: Array<[string, string[], boolean?]> = [
    ['grupa 1', ['1']],
    ['grupa 10', ['10']],
    ['Gr. 13', ['13']],
    ['gr 13', ['13']],
    ['grupa nr 13', ['13']],
    ['grupa 13a', ['13A']],
    ['grupa 13 a', ['13A']],
    ['13A', ['13A'], true],
    ['13 A', ['13A'], true],
    ['13A, 13B', ['13A', '13B'], true],
    ['13A/13B', ['13A', '13B'], true],
    ['13A i 13B', ['13A', '13B'], true],
    ['13A + 13B', ['13A', '13B'], true],
    ['grupa 13 a b, c', ['13A', '13B', '13C']],
    ['grupa 13a 13b 13c', ['13A', '13B', '13C']],
    ['grupa 13a i 13b', ['13A', '13B']],
    ['13a1', ['13A1'], true],
    ['13 c 2', ['13C2'], true],
    ['grupa 13D', ['13D']],
    ['13 F 2', ['13F2'], true],
    ['grupa 7 d e, f', ['7D', '7E', '7F']],
    ['grupa 13 d i e', ['13D', '13E']],
    ['grupa 13I', ['13I']],
    ['grupa 34F2', ['34F2']],
  ];

  it.each(cases)('%s -> %j', (input, expected, allowBare = false) => {
    expect(normalizeGroupText(input, allowBare).groups).toEqual(expected);
  });

  it('usuwa gwiazdki-przypisy tylko z jednoznacznego oznaczenia grupy', () => {
    expect(normalizeGroupText('4b*', true).groups).toEqual(['4B']);
    expect(normalizeGroupText('6a **', true).groups).toEqual(['6A']);
    expect(normalizeGroupText('1a***', true).groups).toEqual(['1A']);
  });

  it('normalizuje warianty kliniki', () => {
    expect(normalizeGroupText('grupa 13A - Klinika I')).toMatchObject({ groups: ['13A'], clinic: 'Klinika I' });
    expect(normalizeGroupText('grupa 13B (klinika ii)')).toMatchObject({ groups: ['13B'], clinic: 'Klinika II' });
    expect(normalizeGroupText('grupa 13A - Klinika 1')).toMatchObject({ groups: ['13A'], clinic: 'Klinika I' });
    expect(normalizeGroupText('grupa 13A - Klin. I')).toMatchObject({ groups: ['13A'], clinic: 'Klinika I' });
  });

  it('nie myli słowa grupy ze skrótem gr', () => {
    expect(normalizeGroupText('grupy 8-osobowe', true).groups).toEqual([]);
    expect(normalizeGroupText('zajęcia praktyczne - grupy 12-osobowe', true).groups).toEqual([]);
    expect(normalizeGroupText('gr 13').groups).toEqual(['13']);
    expect(normalizeGroupText('gr. 13A').groups).toEqual(['13A']);
  });

  it('nie uznaje zwykłego numeru za grupę bez świadomego kontekstu', () => {
    expect(normalizeGroupText('13').groups).toEqual([]);
    expect(normalizeGroupText('204').groups).toEqual([]);
  });

  it('nie używa substring matching ani niejednoznacznej hierarchii dla starych etykiet', () => {
    expect(groupSetsIntersect(['10'], ['1'])).toBe(false);
    expect(groupSetsIntersect(['11'], ['1'])).toBe(false);
    expect(groupSetsIntersect(['1'], ['10'])).toBe(false);
    expect(groupSetsIntersect(['13A'], ['13'])).toBe(false);
    expect(groupSetsIntersect(['13'], ['13A'])).toBe(false);
    expect(groupSetsIntersect(['13A'], ['13A'])).toBe(true);
  });

  it('rozróżnia grupy 12-, 8- i 4-osobowe i dziedziczy tylko relacje jednoznaczne', () => {
    expect(groupSetsIntersect(['MAIN:13'], ['G4:13A1'])).toBe(true);
    expect(groupSetsIntersect(['G8:13A'], ['G4:13A1'])).toBe(true);
    expect(groupSetsIntersect(['G12:13A'], ['G4:13A1'])).toBe(false);
    expect(groupSetsIntersect(['G12:13A'], ['G8:13A'])).toBe(false);
    expect(groupSetsIntersect(['G4:13A1'], ['G4:13A2'])).toBe(false);
  });


  it('usuwa redundantny wybór G8, gdy dokładna grupa G4 już go wyznacza', () => {
    expect(canonicalizeStudyGroupSelection(['MAIN:2', 'G12:2A', 'G8:2B', 'G4:2B1'])).toEqual([
      'MAIN:2', 'G12:2A', 'G4:2B1',
    ]);
    expect(canonicalizeStudyGroupSelection(['MAIN:2', 'G12:2A', 'G8:2B'])).toEqual([
      'MAIN:2', 'G12:2A', 'G8:2B',
    ]);
  });

  it('usuwa ukryty stary wybór G8, jeśli aktualny plan wymaga dokładnego G4', () => {
    const available = ['MAIN:2', 'G12:2A', 'G8:2A', 'G8:2B', 'G4:2A1', 'G4:2A2', 'G4:2B1', 'G4:2B2'];
    expect(normalizeStudyGroupSelectionForAvailableGroups(available, ['MAIN:2', 'G12:2A', 'G8:2B'])).toEqual([
      'MAIN:2', 'G12:2A',
    ]);
    expect(normalizeStudyGroupSelectionForAvailableGroups(['MAIN:2', 'G12:2A', 'G8:2B'], ['MAIN:2', 'G12:2A', 'G8:2B'])).toEqual([
      'MAIN:2', 'G12:2A', 'G8:2B',
    ]);
  });

  it('pokazuje użytkownikowi czytelny typ grupy zamiast klucza technicznego', () => {
    expect(studyGroupDisplayLabel('MAIN:13')).toBe('13 - grupa główna');
    expect(studyGroupDisplayLabel('G12:13A')).toBe('13A - grupa 12-os.');
    expect(studyGroupDisplayLabel('G8:13A')).toBe('13A - grupa 8-os.');
    expect(studyGroupDisplayLabel('G4:13A1')).toBe('13A1 - grupa 4-os.');
  });

  it('ma krótki jednoznaczny opis grupy do chipów w kalendarzu', () => {
    expect(studyGroupCompactLabel('MAIN:10')).toBe('10 · główna');
    expect(studyGroupCompactLabel('G12:10A')).toBe('10A · 12-os.');
    expect(studyGroupCompactLabel('G8:10A')).toBe('10A · 8-os.');
    expect(studyGroupCompactLabel('G4:10A1')).toBe('10A1 · 4-os.');
  });
});
