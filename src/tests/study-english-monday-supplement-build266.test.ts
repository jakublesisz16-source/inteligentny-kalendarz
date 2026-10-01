import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  commitUniversityImport,
  deleteDatabaseForTests,
  deleteManualEventSeries,
  ensureEnglishMondayStudySupplement,
  initializeDatabase,
  listEvents,
} from '../storage/database';
import type { StudyScheduleCandidate } from '../study/study.types';
import {
  ENGLISH_MONDAY_SUPPLEMENT_END,
  ENGLISH_MONDAY_SUPPLEMENT_PROFILE,
  ENGLISH_MONDAY_SUPPLEMENT_SERIES_ID,
  ENGLISH_MONDAY_SUPPLEMENT_START,
  englishMondaySupplementDates,
  matchesEnglishMondaySupplementProfile,
} from '../study/user-confirmed-study-supplements';

function sourceCandidate(id: string, date: string): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'nursing-week-matrix-v2',
    sourceSheet: 'PLAN ZAJĘĆ',
    sourceRange: `A${id}`,
    sourceKey: `source-${id}`,
    originalText: `Źródłowe zajęcia ${date}`,
    subject: 'Zajęcia źródłowe',
    date,
    startTime: '08:00',
    endTime: '09:00',
    groupScope: 'ALL',
    groupTags: [],
    status: 'READY',
    warnings: [],
    include: true,
  };
}

beforeEach(async () => { await deleteDatabaseForTests(); });
afterEach(async () => { await deleteDatabaseForTests(); });

describe('Build266 - potwierdzony język angielski w poniedziałki', () => {
  it('wiąże regułę z grupą główną 11 niezależnie od podgrup', () => {
    expect(matchesEnglishMondaySupplementProfile([...ENGLISH_MONDAY_SUPPLEMENT_PROFILE])).toBe(true);
    expect(matchesEnglishMondaySupplementProfile(['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'])).toBe(true);
    expect(matchesEnglishMondaySupplementProfile(['MAIN:11', 'G12:11A', 'G8:11A', 'G4:11A1'])).toBe(true);
    expect(matchesEnglishMondaySupplementProfile(['MAIN:12', 'G12:12A', 'G8:12A', 'G4:12A1'])).toBe(false);
  });

  it('tworzy poniedziałki tylko w horyzoncie aktywnego planu i pomija znane dni wolne', () => {
    const result = englishMondaySupplementDates([
      { date: '2026-10-05' },
      { date: '2027-01-29' },
    ]);
    expect(result.skippedDaysOff).toEqual(['2026-10-05', '2026-12-21', '2026-12-28']);
    expect(result.dates).toEqual([
      '2026-10-12', '2026-10-19', '2026-10-26',
      '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30',
      '2026-12-07', '2026-12-14',
      '2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25',
    ]);
  });

  it('dodaje 14 terminów 17:15-18:45 bez lokalizacji, jest idempotentny i respektuje usunięcie serii', async () => {
    await initializeDatabase();
    const allCandidates = [sourceCandidate('1', '2026-10-05'), sourceCandidate('2', '2027-01-29')];
    await commitUniversityImport({
      fileName: 'plan.xls',
      fileSize: 123,
      fileHash: 'build266-english-test',
      adapterId: 'nursing-week-matrix-v2',
      sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: ['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'],
      availableGroups: ['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'],
      candidates: allCandidates,
      allCandidates,
    });

    const first = await ensureEnglishMondayStudySupplement();
    expect(first).toMatchObject({ addedEventCount: 14, targetDateCount: 14, skippedDayOffCount: 3, suppressed: false });
    const english = (await listEvents()).filter((event) => event.seriesId === ENGLISH_MONDAY_SUPPLEMENT_SERIES_ID);
    expect(english).toHaveLength(14);
    expect(english.every((event) => event.title === 'Język angielski')).toBe(true);
    expect(english.every((event) => event.startDateTime.slice(11, 16) === ENGLISH_MONDAY_SUPPLEMENT_START)).toBe(true);
    expect(english.every((event) => event.endDateTime.slice(11, 16) === ENGLISH_MONDAY_SUPPLEMENT_END)).toBe(true);
    expect(english.every((event) => !event.locationId && !event.locationText)).toBe(true);
    expect(english.map((event) => event.startDateTime.slice(0, 10))).not.toContain('2026-10-05');
    expect(english.map((event) => event.startDateTime.slice(0, 10))).not.toContain('2026-12-21');
    expect(english.map((event) => event.startDateTime.slice(0, 10))).not.toContain('2026-12-28');

    expect((await ensureEnglishMondayStudySupplement()).addedEventCount).toBe(0);
    await deleteManualEventSeries(ENGLISH_MONDAY_SUPPLEMENT_SERIES_ID);
    const afterDelete = await ensureEnglishMondayStudySupplement();
    expect(afterDelete.suppressed).toBe(true);
    expect((await listEvents()).filter((event) => event.seriesId === ENGLISH_MONDAY_SUPPLEMENT_SERIES_ID)).toHaveLength(0);
  });
});
