import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  commitUniversityImport,
  createLocation,
  deleteLocation,
  deleteEvent,
  getEvent,
  deleteDatabaseForTests,
  initializeDatabase,
  listEvents,
  listLocations,
  listTrashItems,
  listUniversityImportEntries,
  restoreTrashItem,
} from '../storage/database';
import type { StudyScheduleCandidate } from '../study/study.types';
import { buildGoogleMapsDirectionsUrl } from '../locations/google-maps';

beforeEach(async () => {
  await deleteDatabaseForTests();
  await initializeDatabase();
});

afterEach(async () => {
  await deleteDatabaseForTests();
});

describe('study location provenance persistence', () => {
  it('persists provenance with the import entry without a schema bump', async () => {
    const candidate: StudyScheduleCandidate = {
      id: 'build316-provenance',
      adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ',
      sourceRange: 'DE8',
      sourceKey: 'build316-provenance',
      originalText: 'build316 provenance',
      subject: 'INTERNA (seminaria)',
      date: '2026-10-15',
      startTime: '16:45',
      endTime: '20:30',
      groupScope: 'SPECIFIC',
      groupTags: ['MAIN:11'],
      room: 'Aula A',
      address: 'ul. Trojdena 2a',
      locationLabel: 'Centrum Dydaktyczne',
      status: 'READY',
      warnings: [],
      include: true,
      locationProvenance: [
        { field: 'room', source: 'SOURCE_CROSS_REFERENCE', evidence: 'DE4: czwartek - aula A w CD' },
        { field: 'address', source: 'OFFICIAL_EXTERNAL', evidence: 'oficjalny adres CD: ul. Księcia Trojdena 2a' },
      ],
    };

    const result = await commitUniversityImport({
      fileName: 'build316.xls',
      fileSize: 1,
      fileHash: 'build316',
      adapterId: candidate.adapterId,
      sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: ['MAIN:11'],
      availableGroups: ['MAIN:11'],
      allowScheduleConflicts: true,
      candidates: [candidate],
      allCandidates: [candidate],
    });

    const entries = await listUniversityImportEntries(result.importRecord.id);
    expect(entries).toHaveLength(2);
    const eventEntry = entries.find((entry) => !entry.sourceOnly && Boolean(entry.eventId));
    const sourceEntry = entries.find((entry) => entry.sourceOnly);
    expect(eventEntry?.locationProvenance).toEqual(candidate.locationProvenance);
    expect(sourceEntry?.locationProvenance).toEqual(candidate.locationProvenance);
  });
  it('keeps a source place label as name, not a guessed address or navigation destination', async () => {
    const candidate: StudyScheduleCandidate = {
      id: 'label-only-1', adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ', sourceRange: 'A1', sourceKey: 'label-only:A1',
      originalText: 'Seminaria w Zakładzie X', subject: 'Seminaria',
      date: '2026-11-02', startTime: '09:00', endTime: '10:30',
      groupScope: 'ALL', groupTags: [], locationLabel: 'Zakład X',
      status: 'READY', warnings: [], include: true,
    };
    const result = await commitUniversityImport({
      fileName: 'label-only.xls', fileSize: 1, fileHash: 'label-only',
      adapterId: candidate.adapterId, sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: [], availableGroups: [], candidates: [candidate], allCandidates: [candidate],
    });
    const events = await listEvents();
    const locations = await listLocations();
    expect(result.eventCount).toBe(1);
    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({ name: 'Zakład X', address: '' });
    expect(buildGoogleMapsDirectionsUrl(locations[0]!)).toBeUndefined();
    expect(events[0]?.locationId).toBe(locations[0]?.id);
    const entries = await listUniversityImportEntries(result.importRecord.id);
    expect(entries.find((entry) => !entry.sourceOnly)?.locationLabel).toBe('Zakład X');
    expect(entries.find((entry) => !entry.sourceOnly)?.address).toBeUndefined();
  });

  it('still stores the explicitly confirmed street address alongside the place label', async () => {
    const candidate: StudyScheduleCandidate = {
      id: 'confirmed-address-1', adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ', sourceRange: 'B1', sourceKey: 'address:B1',
      originalText: 'Wykład w Centrum', subject: 'Wykład',
      date: '2026-11-03', startTime: '09:00', endTime: '10:30',
      groupScope: 'ALL', groupTags: [], locationLabel: 'Centrum Dydaktyczne',
      address: 'ul. Trojdena 2a', status: 'READY', warnings: [], include: true,
    };
    await commitUniversityImport({
      fileName: 'with-address.xls', fileSize: 1, fileHash: 'with-address',
      adapterId: candidate.adapterId, sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: [], availableGroups: [], candidates: [candidate], allCandidates: [candidate],
    });
    const locations = await listLocations();
    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({ name: 'Centrum Dydaktyczne', address: 'ul. Trojdena 2a' });
    expect(buildGoogleMapsDirectionsUrl(locations[0]!)).toContain('Trojdena');
  });


  it('does not reuse a historical fabricated address for new label-only study entries', async () => {
    // An old import could copy a source label into Location.address.
    // Existing data stays untouched, but it must not contaminate a fresh import.
    const historical = await createLocation({ name: 'Zakład X', type: 'UNIVERSITY', address: 'Zakład X' });
    const makeCandidate = (id: string, date: string): StudyScheduleCandidate => ({
      id, adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ', sourceRange: id, sourceKey: id,
      originalText: 'Seminaria - Zakład X', subject: 'Seminaria',
      date, startTime: '09:00', endTime: '10:00',
      groupScope: 'ALL', groupTags: [], locationLabel: 'Zakład X',
      status: 'READY', warnings: [], include: true,
    });
    const candidates = [makeCandidate('B1', '2026-11-04'), { ...makeCandidate('B2', '2026-11-05'), address: '' }];
    await commitUniversityImport({
      fileName: 'only-label.xls', fileSize: 1, fileHash: 'only-label-with-legacy-location',
      adapterId: 'nursing-week-matrix-v2', sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: [], availableGroups: [], candidates, allCandidates: candidates,
    });
    const locations = await listLocations();
    const events = await listEvents();
    expect(locations).toHaveLength(2);
    expect(locations.find((location) => location.id === historical.id)?.address).toBe('Zakład X');
    const safeLocation = locations.find((location) => location.id !== historical.id);
    expect(safeLocation).toMatchObject({ name: 'Zakład X', address: '' });
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.locationId === safeLocation?.id)).toBe(true);
    expect(buildGoogleMapsDirectionsUrl(safeLocation!)).toBeUndefined();
  });

  it('still reuses a historical location when an address is explicitly present in the source', async () => {
    const historical = await createLocation({ name: 'Centrum', type: 'UNIVERSITY', address: 'ul. Dobra 1' });
    const candidate: StudyScheduleCandidate = {
      id: 'legacy-confirmed', adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ', sourceRange: 'C1', sourceKey: 'C1',
      originalText: 'Zajęcia w Centrum', subject: 'Zajęcia',
      date: '2026-11-06', startTime: '08:00', endTime: '09:30',
      groupScope: 'ALL', groupTags: [], locationLabel: 'Centrum', address: 'ul. Dobra 1',
      status: 'READY', warnings: [], include: true,
    };
    await commitUniversityImport({
      fileName: 'explicit-street.xls', fileSize: 1, fileHash: 'explicit-street-with-legacy-location',
      adapterId: candidate.adapterId, sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: [], availableGroups: [], candidates: [candidate], allCandidates: [candidate],
    });
    expect(await listLocations()).toHaveLength(1);
    expect((await listEvents())[0]?.locationId).toBe(historical.id);
  });

  it('does not attach a study class to an unrelated private location with the same name', async () => {
    const personal = await createLocation({ name: 'Zakład X', type: 'OTHER', address: '' });
    const candidate: StudyScheduleCandidate = {
      id: 'study-versus-private', adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ', sourceRange: 'D1', sourceKey: 'D1',
      originalText: 'Zajęcia w Zakładzie X', subject: 'Seminaria',
      date: '2026-11-09', startTime: '08:00', endTime: '09:00',
      groupScope: 'ALL', groupTags: [], locationLabel: 'Zakład X',
      status: 'READY', warnings: [], include: true,
    };
    await commitUniversityImport({
      fileName: 'different-location-types.xls', fileSize: 1, fileHash: 'study-versus-private',
      adapterId: candidate.adapterId, sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: [], availableGroups: [], candidates: [candidate], allCandidates: [candidate],
    });
    const locations = await listLocations();
    const studyLocation = locations.find((location) => location.id !== personal.id);
    expect(locations).toHaveLength(2);
    expect(locations.find((location) => location.id === personal.id)).toMatchObject({ type: 'OTHER', address: '' });
    expect(studyLocation).toMatchObject({ name: 'Zakład X', type: 'UNIVERSITY', address: '' });
    expect((await listEvents())[0]?.locationId).toBe(studyLocation?.id);
  });

  it('does not attach a study class to a work location even when its address matches', async () => {
    const work = await createLocation({ name: 'Centrum', type: 'WORK', address: 'ul. Dobra 1' });
    const candidate: StudyScheduleCandidate = {
      id: 'study-versus-work', adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ', sourceRange: 'E1', sourceKey: 'E1',
      originalText: 'Wykład w Centrum', subject: 'Wykład',
      date: '2026-11-10', startTime: '08:00', endTime: '09:00',
      groupScope: 'ALL', groupTags: [], locationLabel: 'Centrum', address: 'ul. Dobra 1',
      status: 'READY', warnings: [], include: true,
    };
    await commitUniversityImport({
      fileName: 'work-address-overlap.xls', fileSize: 1, fileHash: 'study-versus-work',
      adapterId: candidate.adapterId, sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: [], availableGroups: [], candidates: [candidate], allCandidates: [candidate],
    });
    const locations = await listLocations();
    const studyLocation = locations.find((location) => location.id !== work.id);
    expect(locations).toHaveLength(2);
    expect(locations.find((location) => location.id === work.id)).toMatchObject({ type: 'WORK', address: 'ul. Dobra 1' });
    expect(studyLocation).toMatchObject({ name: 'Centrum', type: 'UNIVERSITY', address: 'ul. Dobra 1' });
    expect((await listEvents())[0]?.locationId).toBe(studyLocation?.id);
  });


  it('restores label-only study events without attaching an old fabricated route', async () => {
    const legacy = await createLocation({ name: 'Zakład X', type: 'UNIVERSITY', address: 'Zakład X' });
    const candidate: StudyScheduleCandidate = {
      id: 'restore-label-only', adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ', sourceRange: 'F1', sourceKey: 'restore-label-only:F1',
      originalText: 'Seminarium w Zakładzie X', subject: 'Seminarium',
      date: '2026-11-16', startTime: '09:00', endTime: '10:30',
      groupScope: 'ALL', groupTags: [], locationLabel: 'Zakład X',
      status: 'READY', warnings: [], include: true,
    };
    const result = await commitUniversityImport({
      fileName: 'restore-label.xls', fileSize: 1, fileHash: 'restore-label-510',
      adapterId: candidate.adapterId, sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: [], availableGroups: [], candidates: [candidate], allCandidates: [candidate],
    });
    const [original] = (await listEvents()).filter((event) => event.source === 'UNIVERSITY_XLSX');
    expect(original?.locationId).toBeDefined();
    expect(original?.locationId).not.toBe(legacy.id);
    await deleteEvent(original!.id);
    expect(await getEvent(original!.id)).toBeUndefined();
    const [trash] = await listTrashItems();
    expect(trash).toBeDefined();
    await restoreTrashItem(trash!.id);
    const restored = await getEvent(original!.id);
    const locations = await listLocations();
    const entries = await listUniversityImportEntries(result.importRecord.id);
    expect(restored?.source).toBe('UNIVERSITY_XLSX');
    expect(restored?.locationId).toBe(original?.locationId);
    expect(locations.find((location) => location.id === restored?.locationId)).toMatchObject({ name: 'Zakład X', address: '' });
    expect(buildGoogleMapsDirectionsUrl(locations.find((location) => location.id === restored?.locationId)!)).toBeUndefined();
    expect(locations.find((location) => location.id === legacy.id)?.address).toBe('Zakład X');
    expect(entries.find((entry) => entry.eventId === restored?.id && !entry.sourceOnly)?.userDeleted).toBe(false);
    expect(await listTrashItems()).toHaveLength(0);
    expect((await listEvents()).filter((event) => event.source === 'UNIVERSITY_XLSX')).toHaveLength(1);
  });

  it('preserves separation from a private location after deleting and restoring a study event', async () => {
    const privateLocation = await createLocation({ name: 'Centrum', type: 'OTHER', address: 'ul. Prywatna 10' });
    const candidate: StudyScheduleCandidate = {
      id: 'restore-other-collision', adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ', sourceRange: 'G1', sourceKey: 'restore-other-collision:G1',
      originalText: 'Wykład w Centrum', subject: 'Wykład',
      date: '2026-11-17', startTime: '08:00', endTime: '09:30',
      groupScope: 'ALL', groupTags: [], locationLabel: 'Centrum', address: 'ul. Prywatna 10',
      status: 'READY', warnings: [], include: true,
    };
    await commitUniversityImport({
      fileName: 'restore-type.xls', fileSize: 1, fileHash: 'restore-type-510',
      adapterId: candidate.adapterId, sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: [], availableGroups: [], candidates: [candidate], allCandidates: [candidate],
    });
    const [original] = (await listEvents()).filter((event) => event.source === 'UNIVERSITY_XLSX');
    expect(original?.locationId).not.toBe(privateLocation.id);
    await deleteEvent(original!.id);
    const [trash] = await listTrashItems();
    await restoreTrashItem(trash!.id);
    const restored = await getEvent(original!.id);
    const locations = await listLocations();
    expect(restored?.locationId).toBe(original?.locationId);
    expect(restored?.locationId).not.toBe(privateLocation.id);
    expect(locations.find((location) => location.id === privateLocation.id)).toMatchObject({ type: 'OTHER', address: 'ul. Prywatna 10' });
    expect(locations.find((location) => location.id === restored?.locationId)).toMatchObject({ type: 'UNIVERSITY', address: 'ul. Prywatna 10' });
    expect((await listEvents()).filter((event) => event.source === 'UNIVERSITY_XLSX')).toHaveLength(1);
  });

  it.each([
    { label: 'Zakład X', address: undefined, expectsRoute: false },
    { label: 'Centrum Dydaktyczne', address: 'ul. Trojdena 2a', expectsRoute: true },
  ])('recreates only source-confirmed venue after the location is removed while study event is in Trash: $label', async ({ label, address, expectsRoute }) => {
    const candidate: StudyScheduleCandidate = {
      id: `restore-missing-${expectsRoute}`, adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ', sourceRange: 'H1', sourceKey: `missing-venue:${label}`,
      originalText: `Wykład w ${label}`, subject: 'Wykład',
      date: '2026-11-18', startTime: '10:00', endTime: '11:30',
      groupScope: 'ALL', groupTags: [], locationLabel: label,
      ...(address ? { address } : {}),
      status: 'READY', warnings: [], include: true,
    };
    const importResult = await commitUniversityImport({
      fileName: 'restore-missing-venue.xls', fileSize: 1, fileHash: `restore-missing-${expectsRoute}`,
      adapterId: candidate.adapterId, sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: [], availableGroups: [], candidates: [candidate], allCandidates: [candidate],
    });
    const [original] = await listEvents();
    const originalLocationId = original!.locationId;
    expect(originalLocationId).toBeDefined();
    await deleteEvent(original!.id);
    await deleteLocation(originalLocationId!);
    expect(await listLocations()).toHaveLength(0);

    const [trash] = await listTrashItems();
    await restoreTrashItem(trash!.id);
    const restored = await getEvent(original!.id);
    const [recoveredLocation] = await listLocations();
    expect(restored?.source).toBe('UNIVERSITY_XLSX');
    expect(restored?.locationId).toBe(recoveredLocation?.id);
    expect(recoveredLocation?.id).not.toBe(originalLocationId);
    expect(recoveredLocation).toMatchObject({ name: label, address: address ?? '' });
    expect(Boolean(buildGoogleMapsDirectionsUrl(recoveredLocation!))).toBe(expectsRoute);
    expect((await listUniversityImportEntries(importResult.importRecord.id)).find((entry) => entry.eventId === original!.id && !entry.sourceOnly)?.userDeleted).toBe(false);
    expect(await listTrashItems()).toHaveLength(0);
  });

});
