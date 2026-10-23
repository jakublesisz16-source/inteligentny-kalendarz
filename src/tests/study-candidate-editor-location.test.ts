import { describe, expect, it } from 'vitest';
import { applyCandidateEditorLocation } from '../study/study-corrections';
import type { StudyScheduleCandidate } from '../study/study.types';

function source(partial: Partial<StudyScheduleCandidate> = {}): StudyScheduleCandidate {
  return {
    id: 'test', adapterId: 'fixture', sourceSheet: 'PLAN ZAJĘĆ',
    sourceRange: 'A1', sourceKey: 'fixture:A1', originalText: 'Test',
    subject: 'Przedmiot', groupScope: 'ALL', groupTags: [],
    status: 'READY', warnings: [], include: true, ...partial,
  };
}

describe('Study editor preserves location provenance', () => {
  it('does not turn a source location label into a fabricated address after changing a different field', () => {
    const original = source({ locationLabel: 'Zakład pielęgniarstwa' });
    const changedSubject = { ...original, subject: 'Nowy przedmiot' };
    const result = applyCandidateEditorLocation(original, changedSubject, 'Zakład pielęgniarstwa');
    expect(result.locationLabel).toBe('Zakład pielęgniarstwa');
    expect(result.address).toBeUndefined();
    expect(original.address).toBeUndefined();
  });

  it('preserves a confirmed address when the field was not touched', () => {
    const original = source({ address: 'ul. Ciołka 27', locationLabel: 'Budynek A' });
    expect(applyCandidateEditorLocation(original, { ...original }, 'ul. Ciołka 27'))
      .toEqual(original);
  });

  it('only converts the label to an address after an explicit edit', () => {
    const original = source({ locationLabel: 'Szpital' });
    const updated = applyCandidateEditorLocation(original, { ...original }, ' ul. Testowa 1 ');
    expect(updated.address).toBe('ul. Testowa 1');
    expect(updated.locationLabel).toBeUndefined();
    expect(original.locationLabel).toBe('Szpital');
  });

  it('respects explicit clearing of the combined editor field', () => {
    const original = source({ locationLabel: 'Niepotwierdzone miejsce' });
    const updated = applyCandidateEditorLocation(original, { ...original }, '');
    expect(updated.address).toBeUndefined();
    expect(updated.locationLabel).toBeUndefined();
  });

  it('preserves a label when no content change was made except spaces', () => {
    const original = source({ locationLabel: '  Zakład  ' });
    const updated = applyCandidateEditorLocation(original, { ...original }, 'Zakład');
    expect(updated.locationLabel).toBe('  Zakład  ');
    expect(updated.address).toBeUndefined();
  });
});
