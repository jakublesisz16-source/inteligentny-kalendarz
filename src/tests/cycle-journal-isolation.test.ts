import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('0.6.0 Cycle Journal isolation', () => {
  it('does not feed journal data into cycle-v1 or the notification planner', () => {
    const prediction = source('../cycle/cycle-prediction.ts');
    const planner = source('../notifications/notification-planner.ts');
    expect(prediction).not.toContain('CycleJournal');
    expect(prediction).not.toContain('cycleJournal');
    expect(planner).not.toContain('CycleJournal');
    expect(planner).not.toContain('cycleJournal');
  });

  it('keeps pain medication out of patterns, prediction, push and service worker', () => {
    const patterns = source('../cycle/cycle-patterns.ts');
    const prediction = source('../cycle/cycle-prediction.ts');
    const planner = source('../notifications/notification-planner.ts');
    const serviceWorker = source('../../public/service-worker.js');
    expect(patterns).not.toContain('painMedicationTaken');
    expect(prediction).not.toContain('painMedicationTaken');
    expect(planner).not.toContain('painMedicationTaken');
    expect(serviceWorker).not.toContain('painMedicationTaken');
  });

  it('refreshes journal CRUD locally instead of using global onDataChanged', () => {
    const view = source('../cycle/CycleView.tsx');
    const saveBlock = view.slice(view.indexOf('async function saveJournalEditor'), view.indexOf('async function removeJournalEditor'));
    const removeBlock = view.slice(view.indexOf('async function removeJournalEditor'), view.indexOf('async function saveEndToday'));
    expect(saveBlock).toContain('refreshJournal()');
    expect(removeBlock).toContain('refreshJournal()');
    expect(saveBlock).not.toContain('onDataChanged');
    expect(removeBlock).not.toContain('onDataChanged');
  });
});
