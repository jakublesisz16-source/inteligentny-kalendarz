import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyVerifiedStudyPlanManualCorrectionsToActivePlan,
  commitUniversityImport,
  deleteDatabaseForTests,
  initializeDatabase,
  getActiveUniversityImport,
  listEvents,
  listLocations,
  listUniversityImportEntries,
} from '../storage/database';
import type { StudyScheduleCandidate } from '../study/study.types';
import { VERIFIED_STUDY_PLAN_2026_10_02 } from '../study/verified-study-plan';

beforeEach(async () => {
  await deleteDatabaseForTests();
  await initializeDatabase();
});

afterEach(async () => {
  await deleteDatabaseForTests();
});

function wrongInternaCandidate(): StudyScheduleCandidate {
  return {
    id: 'candidate-interna-1510',
    adapterId: 'nursing-week-matrix-v2',
    sourceSheet: 'PLAN ZAJĘĆ',
    sourceRange: 'DE8',
    sourceKey: 'PLAN ZAJĘĆ|DE8|2026-10-15|16:45|20:30|INTERNA (seminaria)|MAIN:11',
    originalText: '15.10. grupa 11 INTERNA seminaria',
    subject: 'INTERNA (seminaria)',
    activityType: 'Seminaria',
    date: '2026-10-15',
    startTime: '16:45',
    endTime: '20:30',
    groupScope: 'SPECIFIC',
    groupTags: ['MAIN:11'],
    address: 'ul. Ciołka 27',
    locationLabel: 'Zakład Rozwoju Pielęgniarstwa',
    status: 'READY',
    warnings: [],
    include: true,
  };
}

describe('Build310 active-plan repair', () => {
  it('repairs an already imported exact-source event without requiring reupload', async () => {
    const source = wrongInternaCandidate();
    await commitUniversityImport({
      fileName: VERIFIED_STUDY_PLAN_2026_10_02.sourceName,
      fileSize: VERIFIED_STUDY_PLAN_2026_10_02.sizeBytes,
      fileHash: VERIFIED_STUDY_PLAN_2026_10_02.sha256,
      adapterId: 'nursing-week-matrix-v2',
      sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: ['MAIN:11'],
      availableGroups: ['MAIN:11'],
      candidates: [source],
      allCandidates: [source],
      allowScheduleConflicts: true,
    });

    const beforeEvent = (await listEvents())[0]!;
    const beforeLocation = (await listLocations()).find((location) => location.id === beforeEvent.locationId);
    expect(beforeLocation?.address).toBe('ul. Ciołka 27');

    const repair = await applyVerifiedStudyPlanManualCorrectionsToActivePlan();
    expect(repair).toMatchObject({ matchedSource: true, correctedEntryCount: 2, correctedEventCount: 1 });

    const event = (await listEvents())[0]!;
    const location = (await listLocations()).find((item) => item.id === event.locationId);
    expect(location?.address).toBe('ul. Trojdena 2a');
    expect(event.description).toContain('Aula A');
  });

  it('removes previously inferred Stec events while keeping the raw source evidence', async () => {
    const inferredStec: StudyScheduleCandidate = {
      id: 'candidate-interna-stec-0712',
      adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ',
      sourceRange: 'S16',
      sourceKey: 'PLAN ZAJĘĆ|S16|2026-12-07|INTERNA|G8:11B',
      originalText: '11b - Prof. R. Stec',
      subject: 'INTERNA',
      activityType: 'Zajęcia praktyczne',
      date: '2026-12-07',
      startTime: '07:30',
      endTime: '14:00',
      groupScope: 'SPECIFIC',
      groupTags: ['G8:11B'],
      address: 'ul. Banacha 1a',
      locationLabel: 'Klinika Onkologii',
      status: 'READY',
      warnings: [],
      include: true,
      inferredFields: ['startTime', 'endTime'],
      inferenceNotes: ['legacy recurring inference'],
    };
    await commitUniversityImport({
      fileName: VERIFIED_STUDY_PLAN_2026_10_02.sourceName,
      fileSize: VERIFIED_STUDY_PLAN_2026_10_02.sizeBytes,
      fileHash: VERIFIED_STUDY_PLAN_2026_10_02.sha256,
      adapterId: 'nursing-week-matrix-v2',
      sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: ['G8:11B'],
      availableGroups: ['G8:11B'],
      candidates: [inferredStec],
      allCandidates: [inferredStec],
      allowScheduleConflicts: true,
    });

    expect(await listEvents()).toHaveLength(1);
    const repair = await applyVerifiedStudyPlanManualCorrectionsToActivePlan();
    expect(repair.removedInferredEventCount).toBe(1);
    expect(await listEvents()).toHaveLength(0);
    const active = await getActiveUniversityImport();
    expect(active?.importedEventCount).toBe(0);
    const entries = await listUniversityImportEntries(active!.id);
    expect(entries.filter((entry) => !entry.sourceOnly)).toHaveLength(0);
    const sourceEntry = entries.find((entry) => entry.sourceOnly && entry.sourceRange === 'S16');
    expect(sourceEntry?.startTime).toBeUndefined();
    expect(sourceEntry?.endTime).toBeUndefined();
    expect(sourceEntry?.warnings.join(' ')).toContain('nie podaje pełnego zakresu godzin');
  });

  it('keeps separate university locations for different clinics at the same street address', async () => {
    const pediatrics: StudyScheduleCandidate = {
      id: 'candidate-pediatrics-2311',
      adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ',
      sourceRange: 'AM14',
      sourceKey: 'PLAN ZAJĘĆ|AM14|2026-11-23|08:00|14:00|PEDIATRIA|G4:11B2',
      originalText: '11b2 - PEDIATRIA',
      subject: 'PEDIATRIA',
      activityType: 'Zajęcia praktyczne',
      date: '2026-11-23',
      startTime: '08:00',
      endTime: '14:00',
      groupScope: 'SPECIFIC',
      groupTags: ['G4:11B2'],
      clinic: 'Katedra i Klinika Pediatrii i Nefrologii',
      address: 'ul. Żwirki i Wigury 63A',
      locationLabel: 'Katedra i Klinika Pediatrii i Nefrologii',
      status: 'READY',
      warnings: [],
      include: true,
    };
    const neonatology: StudyScheduleCandidate = {
      ...pediatrics,
      id: 'candidate-neonatology-0801',
      sourceRange: 'DI18',
      sourceKey: 'PLAN ZAJĘĆ|DI18|2027-01-08|15:15|19:00|PEDIATRIA NZYN (seminaria)|MAIN:11',
      originalText: 'PEDIATRIA NZYN seminaria',
      subject: 'PEDIATRIA NZYN (seminaria)',
      activityType: 'Seminaria',
      date: '2027-01-08',
      startTime: '15:15',
      endTime: '19:00',
      groupTags: ['MAIN:11'],
      clinic: 'Klinika Neonatologii i Chorób Rzadkich',
      room: 'sala seminaryjna',
      locationLabel: 'Klinika Neonatologii i Chorób Rzadkich',
    };
    await commitUniversityImport({
      fileName: VERIFIED_STUDY_PLAN_2026_10_02.sourceName,
      fileSize: VERIFIED_STUDY_PLAN_2026_10_02.sizeBytes,
      fileHash: VERIFIED_STUDY_PLAN_2026_10_02.sha256,
      adapterId: 'nursing-week-matrix-v2',
      sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: ['MAIN:11', 'G4:11B2'],
      availableGroups: ['MAIN:11', 'G4:11B2'],
      candidates: [pediatrics, neonatology],
      allCandidates: [pediatrics, neonatology],
      allowScheduleConflicts: true,
    });

    const events = await listEvents();
    expect(events).toHaveLength(2);
    expect(events[0]?.locationId).not.toBe(events[1]?.locationId);
    const locations = await listLocations();
    const names = events.map((event) => locations.find((location) => location.id === event.locationId)?.name).sort();
    expect(names).toEqual([
      'Katedra i Klinika Pediatrii i Nefrologii',
      'Klinika Neonatologii i Chorób Rzadkich',
    ]);
  });

});
