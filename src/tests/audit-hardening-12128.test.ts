import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const database = readFileSync('src/storage/database.ts', 'utf8');
const workService = readFileSync('src/work/work.service.ts', 'utf8');
const availability = readFileSync('src/availability/AvailabilityView.tsx', 'utf8');
const app = readFileSync('src/app/App.tsx', 'utf8');
const workView = readFileSync('src/work/WorkView.tsx', 'utf8');
const safety = readFileSync('src/safety/SafetyCenter.tsx', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.145 audit hardening', () => {
  it('pairs work schedule updates conservatively and detaches unmatched manual edits from historical imports', () => {
    expect(workService).toContain('export function pairWorkScheduleUpdates');
    expect(workService).toContain('oldGroup.length !== 1 || newGroup?.length !== 1');
    expect(database).toContain('const pairings = pairWorkScheduleUpdates(oldEntries, input.shifts);');
    expect(database).toContain('delete detached.sourceWorkImportId;');
    expect(database).toContain('delete detached.sourceWorkEntryId;');
    expect(database).toContain("if (event?.sourceWorkImportId === id) eventStore.delete(entry.eventId);");
  });

  it('does not expose undo when a backing restore point is gone and closes old undo history after a full restore', () => {
    expect(database).toContain("undoUnavailableReason: 'RESTORE_POINT_PRUNED'");
    expect(database).toContain("undoUnavailableReason: 'RESTORE_POINT_DELETED'");
    expect(database).toContain("undoUnavailableReason: 'RESTORE_POINT_MISSING'");
    expect(database).toContain("undoUnavailableReason: 'RESTORE_BARRIER'");
    expect(database).toContain("createRestorePoint('Przed ręcznym przywróceniem punktu', 'BEFORE_RESTORE_POINT', true, false, false)");
    expect(database).toContain('if (restored) await pruneAutomaticRestorePoints();');
    expect(safety).toContain('Starsza oś zmian została zamknięta po przywróceniu całego stanu.');
  });

  it('tracks all cycle entities touched by inserting a period', () => {
    expect(database).toContain("entityIds: [period.id, ...(next && nextUpdated && nextUpdated !== next ? [next.id] : [])]");
  });

  it('guards availability against stale week refreshes and clipboard failures', () => {
    expect(availability).toContain('const refreshRequestRef = useRef(0);');
    expect(availability).toContain('if (requestId !== refreshRequestRef.current) return;');
    expect(availability).toContain("if (!navigator.clipboard?.writeText) throw new Error('Schowek nie jest dostępny w tym środowisku.');");
  });

  it('loads coworker schedules once per work import instead of once per event', () => {
    expect(database).toContain('export async function listCoworkersForWorkEvents');
    expect(database).toContain('const importIds = [...new Set(workEvents.map((event) => event.sourceWorkImportId!))];');
    expect(app).toContain('return listCoworkersForWorkEvents(sourceEvents);');
    expect(workView).toContain('setCoworkersByEvent(await listCoworkersForWorkEvents(pdfEvents));');
  });

  it('keeps the database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
