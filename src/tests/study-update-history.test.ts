import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scheduleUpdateHistoryItems } from '../study/study-diff';
import type { ScheduleDiffItem } from '../study/study.types';

const view = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../study/ScheduleUpdateHistoryModal.tsx', import.meta.url), 'utf8');
const database = readFileSync(new URL('../storage/database.ts', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');

describe('Build341 Study update history', () => {
  it('makes the latest update badge an explicit clickable control with structured status chips', () => {
    expect(view).toContain('className="study-current-plan-change"');
    expect(view).toContain('onClick={() => setUpdateHistoryOpen(true)}');
    expect(view).toContain('<ScheduleUpdateHistoryModal');
    expect(view).toContain('className="study-current-plan-change-label">Zmiany</span>');
    expect(view).toContain('study-current-plan-change-chip is-${item.tone}');
    expect(view).toContain('className="study-current-plan-change-open"');
    expect(view).toContain('const reviewCount = summary.conflicts + summary.ambiguous');
    expect(view).toContain('scheduleConflictCount ? `Konflikty ${scheduleConflictCount}`');
    expect(view).toContain('activePlanUpdateDetails?.scheduleConflicts.length');
  });

  it('shows exact read-only change facts without contradictory zero filters or -0 metrics', () => {
    expect(modal).toContain('title="Zmiany w planie"');
    expect(modal).toContain('study-update-history-summary-compact');
    expect(modal).toContain('{details.summary.removed}');
    expect(modal).not.toContain('-{details.summary.removed}');
    expect(modal).toContain('const showFilters = details.changeItems.length > 1 && detailCategoryCount > 1');
    expect(modal).toContain('Wszystkie ({details.changeItems.length})');
    expect(modal).toContain('Nowe ({itemCounts.added})');
    expect(modal).toContain('było');
    expect(modal).toContain('jest');
    expect(modal).toContain('<strong>Godzina</strong>');
    expect(modal).toContain('<strong>Sala</strong>');
    expect(modal).toContain('<strong>Adres</strong>');
    expect(modal).toContain('Konflikty godzin po aktualizacji');
  });

  it('persists future update details and recovers the audited legacy 05.10 -> 06.10 delta', () => {
    expect(database).toContain('changeItems: scheduleUpdateHistoryItems(preview.items)');
    expect(database).toContain('export async function getAppliedScheduleUpdateDetails');
    expect(database).toContain('verifiedLegacyScheduleUpdateHistory(baseImport, appliedImport, session.summary)');
    expect(database).toContain('changeItems: verifiedHistory ?? []');
    expect(database).toContain('reconstructed: true');
    expect(database).toContain('oldEvents: []');
  });

  it('keeps only visible changes in the compact history payload', () => {
    const items: ScheduleDiffItem[] = [
      { id: 'same', kind: 'UNCHANGED', changeTypes: [], changes: [], resolution: 'SKIP' },
      {
        id: 'new', kind: 'ADDED', changeTypes: [], changes: [], resolution: 'APPLY',
        newCandidate: {
          id: 'new-candidate', adapterId: 'test', sourceSheet: 'PLAN', sourceRange: 'A1', sourceKey: 'A1', originalText: 'x',
          subject: 'Farmakologia', date: '2026-11-12', startTime: '10:15', endTime: '14:00', groupScope: 'SPECIFIC', groupTags: ['MAIN:11'],
          room: 'sala 234', address: 'ul. Trojdena 2a', status: 'READY', warnings: [],
        },
      },
    ];
    expect(scheduleUpdateHistoryItems(items)).toEqual([
      expect.objectContaining({ id: 'new', kind: 'ADDED', subject: 'Farmakologia', date: '2026-11-12', startTime: '10:15', endTime: '14:00' }),
    ]);
  });

  it('uses quiet modular status styling instead of the old flat pink text badge', () => {
    expect(refinement).toContain('Build340 - Study update history control');
    expect(refinement).toContain('.study-current-plan-change-chip.is-added');
    expect(refinement).toContain('background: var(--success-soft)');
    expect(refinement).toContain('.study-current-plan-change-chip.is-review');
    expect(refinement).toContain('background: var(--warning-soft)');
    expect(refinement).toContain('.study-current-plan-change-open');
    expect(refinement).toContain('.study-current-plan-change:hover');
    expect(refinement).toContain('.study-current-plan-change:focus-visible');
  });

  it('does not reconstruct a compacted legacy plan as dozens of newly added lessons', () => {
    expect(database).toContain('if (!baseEntries.length && appliedEntries.length)');
    expect(database).toContain('summary: { ...session.summary, conflicts: 0, ambiguous: 0 }');
    expect(database).toContain('verifiedLegacyScheduleUpdateHistory');
  });
});
