import { describe, expect, it } from 'vitest';
import { applyCorrectionRules, applySafeSeriesCorrection, pendingRulesForSeriesCorrection } from '../study/study-corrections';
import { identifyCandidate } from '../study/study-identity';
import type { StudyCorrectionRule, StudyScheduleCandidate } from '../study/study.types';

function candidate(id: string, date: string, patch: Partial<StudyScheduleCandidate> = {}): StudyScheduleCandidate {
  return identifyCandidate({
    id, adapterId: 'nursing-plan-v1', sourceSheet: 'PRAKTYKI', sourceRange: id, sourceKey: id, originalText: id,
    subject: 'Podstawy pielęgniarstwa', activityType: 'Zajęcia praktyczne', date, startTime: '08:00', endTime: '10:00', groupScope: 'SPECIFIC', groupTags: ['13A'], clinic: 'Klinika I',
    status: 'REVIEW_REQUIRED', warnings: ['Nie udało się jednoznacznie ustalić lokalizacji.'], ...patch,
  });
}

describe('study correction rules', () => {
  it('propaguje adres tylko w tej samej serii', () => {
    const source = candidate('a', '2026-03-01');
    const peer = candidate('b', '2026-03-08');
    const other = candidate('c', '2026-03-08', { groupTags: ['13B'] });
    const corrected = { ...source, address: 'ul. Testowa 1', manuallyReviewed: true };
    const result = applySafeSeriesCorrection([source, peer, other], source, corrected);
    expect(result.find((item) => item.id === 'a')?.address).toBe('ul. Testowa 1');
    expect(result.find((item) => item.id === 'b')?.address).toBe('ul. Testowa 1');
    expect(result.find((item) => item.id === 'c')?.address).toBeUndefined();
  });

  it('tworzy regułę tylko dla bezpiecznego pola lokalizacji', () => {
    const before = candidate('a', '2026-03-01');
    const after = { ...before, address: 'ul. Testowa 1', startTime: '09:00' };
    expect(pendingRulesForSeriesCorrection(before, after)).toEqual([{ seriesKey: before.seriesKey, field: 'address', value: 'ul. Testowa 1' }]);
  });

  it('stosuje regułę gdy nowy plan nadal nie ma adresu', () => {
    const item = candidate('a', '2026-03-01');
    const rule: StudyCorrectionRule = { id: 'r', seriesKey: item.seriesKey!, field: 'address', value: 'ul. Testowa 1', createdAt: 'x', updatedAt: 'x', source: 'USER_SERIES_CORRECTION', active: true };
    const result = applyCorrectionRules([item], [rule]);
    expect(result.candidates[0]?.address).toBe('ul. Testowa 1');
    expect(result.conflicts).toHaveLength(0);
  });

  it('nie nadpisuje jawnie innej wartości z nowego planu', () => {
    const item = candidate('a', '2026-03-01', { address: 'ul. Nowa 1' });
    const rule: StudyCorrectionRule = { id: 'r', seriesKey: item.seriesKey!, field: 'address', value: 'ul. Testowa 1', createdAt: 'x', updatedAt: 'x', source: 'USER_SERIES_CORRECTION', active: true };
    const result = applyCorrectionRules([item], [rule]);
    expect(result.candidates[0]?.address).toBe('ul. Nowa 1');
    expect(result.conflicts).toHaveLength(1);
  });
});
