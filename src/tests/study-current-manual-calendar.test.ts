import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../core/sha256';
import {
  VERIFIED_STUDY_CURRENT_CALENDAR_OPERATIONAL_SHA256,
  VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_08,
  VERIFIED_STUDY_CURRENT_SOURCE_ONLY_COUNT,
  VERIFIED_STUDY_CURRENT_TIMED_EVENT_COUNT,
  VERIFIED_STUDY_CURRENT_UNDATED_REQUIREMENTS_2026_10_08,
} from '../study/verified-study-current-schedule';
import { applyVerifiedStudyPlanManualCorrectionsToAnalysis } from '../study/verified-study-plan-manual';
import { VERIFIED_STUDY_PLAN_2026_10_08 } from '../study/verified-study-plan';
import type { ScheduleAnalysis, StudyScheduleCandidate } from '../study/study.types';
import {
  incompleteStudyEntryMarkerAppliesOnDate,
  incompleteStudyEntryOverlapsRange,
} from '../study/study-incomplete-visibility';

function operationalRows() {
  return VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_08
    .filter((candidate) => candidate.include !== false && candidate.date && candidate.startTime && candidate.endTime)
    .map((candidate) => [
      candidate.date ?? null,
      candidate.startTime ?? null,
      candidate.endTime ?? null,
      candidate.subject ?? null,
      candidate.activityType ?? null,
      candidate.groupScope ?? null,
      [...candidate.groupTags].sort(),
      candidate.clinic ?? null,
      candidate.room ?? null,
      candidate.address ?? null,
      candidate.locationLabel ?? null,
    ])
    .sort((left, right) => {
      const leftKey = [left[0], left[1], left[2], left[3], JSON.stringify(left[6])].join('|');
      const rightKey = [right[0], right[1], right[2], right[3], JSON.stringify(right[6])].join('|');
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
}

function sourceOnlyEntries() {
  return VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_08.filter((candidate) => candidate.include === false);
}

function asImportEntry(candidate: StudyScheduleCandidate) {
  return {
    ...candidate,
    id: `entry-${candidate.id}`,
    importId: 'manual-calendar-test',
    sourceOnly: true,
  };
}

describe('current WUM calendar is fully manual and exact', () => {
  it('stores every source position for the current profile in one explicit snapshot', () => {
    expect(VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_08).toHaveLength(77);
    expect(operationalRows()).toHaveLength(VERIFIED_STUDY_CURRENT_TIMED_EVENT_COUNT);
    expect(sourceOnlyEntries()).toHaveLength(VERIFIED_STUDY_CURRENT_SOURCE_ONLY_COUNT);
    expect(VERIFIED_STUDY_CURRENT_TIMED_EVENT_COUNT).toBe(74);
    expect(VERIFIED_STUDY_CURRENT_SOURCE_ONLY_COUNT).toBe(3);
  });

  it('locks the exact operational calendar fingerprint for dates, times, subjects, groups and places', async () => {
    const hash = await sha256Hex(JSON.stringify(operationalRows()));
    expect(hash).toBe(VERIFIED_STUDY_CURRENT_CALENDAR_OPERATIONAL_SHA256);
  });

  it('contains no duplicate timed calendar events', () => {
    const signatures = operationalRows().map((row) => JSON.stringify(row));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('locks the 8 October change exactly', () => {
    const day = VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_08
      .filter((candidate) => candidate.date === '2026-10-08' && candidate.include !== false)
      .map((candidate) => ({ subject: candidate.subject, start: candidate.startTime, end: candidate.endTime, room: candidate.room, address: candidate.address }))
      .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
    expect(day).toEqual([
      { subject: 'POZ seminaria', start: '12:00', end: '15:45', room: 's. 101 Pato', address: 'ul. Litewska 14/16' },
      { subject: 'CHIRURGIA', start: '16:30', end: '18:00', room: 'AULA A', address: 'ul. Trojdena 2a' },
    ]);
    expect(day.some((entry) => entry.subject === 'PROMOCJA ZDROWIA')).toBe(false);
  });

  it('adds the newly published Thursday Pharmacology seminar for group 11', () => {
    const event = VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_08.find((candidate) => candidate.sourceKey === 'PLAN ZAJĘĆ|DA12|2026-11-12|10:15|14:00|FARMAKOLOGIA|MAIN:11');
    expect(event).toMatchObject({
      subject: 'FARMAKOLOGIA',
      activityType: 'Seminaria',
      date: '2026-11-12',
      startTime: '10:15',
      endTime: '14:00',
      groupTags: ['MAIN:11'],
      room: 'sala komputerowa, sala 234 w CD',
      address: 'ul. Trojdena 2a',
      locationLabel: 'Centrum Dydaktyczne',
      status: 'READY',
      include: true,
      manuallyReviewed: true,
    });
  });

  it('locks all manually verified practical blocks and seminar places', () => {
    const by = (sourceRange: string, date?: string) => VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_08.find((candidate) => candidate.sourceRange === sourceRange && (!date || candidate.date === date));
    expect(by('AM14', '2026-11-23')).toMatchObject({
      startTime: '08:00', endTime: '14:00',
      clinic: 'Katedra i Klinika Pediatrii i Nefrologii', address: 'ul. Żwirki i Wigury 63A',
    });
    expect(by('O16', '2026-12-09')).toMatchObject({
      startTime: '07:30', endTime: '14:00',
      clinic: 'Klinika Chorób Wewnętrznych i Kardiologii', address: 'ul. Lindleya 4',
    });
    expect(by('D20', '2027-01-18')).toMatchObject({
      startTime: '08:00', endTime: '14:00',
      clinic: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej', address: 'ul. Banacha 1a',
    });
    expect(by('DK21', '2027-01-27')).toMatchObject({
      startTime: '15:15', endTime: '19:00',
      room: 'sala seminaryjna 128 w NZS, pawilon XI D1', address: 'ul. Nowogrodzka 59',
    });
    expect(by('A14,B14', '2027-01-05')).toMatchObject({
      startTime: '15:00', endTime: '18:45', clinic: 'Microsoft Teams',
    });
  });

  it('keeps 27-29 October Health Promotion without a guessed room or address', () => {
    for (const date of ['2026-10-27', '2026-10-28', '2026-10-29']) {
      const entry = VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_08.find((candidate) => (
        candidate.sourceRange === 'BC10' && candidate.subject === 'PROM. ZDROWIA' && candidate.date === date
      ))!;
      expect(entry).toMatchObject({
        startTime: '08:00', endTime: '11:00', groupTags: ['G8:11B'],
        clinic: 'Zakład Propedeutyki Pielęgniarstwa', include: true,
      });
      expect(entry.room).toBeUndefined();
      expect(entry.address).toBeUndefined();
      expect(entry.locationLabel).toBeUndefined();
      expect(entry.locationProvenance).toEqual([
        expect.objectContaining({ field: 'clinic', source: 'SOURCE_CROSS_REFERENCE' }),
      ]);
    }
  });

  it('keeps the three source-incomplete classes visible to the calendar without inventing hours', () => {
    const incomplete = sourceOnlyEntries();
    const poz = incomplete.find((candidate) => candidate.sourceRange === 'AY9')!;
    const internaMon = incomplete.find((candidate) => candidate.sourceRange === 'S16')!;
    const internaTue = incomplete.find((candidate) => candidate.sourceRange === 'T16')!;

    expect(poz).toMatchObject({ subject: 'POZ', sourceWeekStart: '2026-10-19', sourceWeekEnd: '2026-10-23', include: false });
    expect(poz.date).toBeUndefined();
    expect(poz.startTime).toBeUndefined();
    expect(poz.endTime).toBeUndefined();
    expect(poz.originalText).toContain('Pierwsze spotkanie - szkolenie RODO i BHP od godz. 8.30');
    expect(incompleteStudyEntryMarkerAppliesOnDate(asImportEntry(poz), '2026-10-19')).toBe(true);
    expect(incompleteStudyEntryOverlapsRange(asImportEntry(poz), '2026-10-19', '2026-10-25')).toBe(true);

    for (const [candidate, date] of [[internaMon, '2026-12-07'], [internaTue, '2026-12-08']] as const) {
      expect(candidate.date).toBe(date);
      expect(candidate.startTime).toBeUndefined();
      expect(candidate.endTime).toBeUndefined();
      expect(candidate.address).toBe('ul. Banacha 1a');
      expect(incompleteStudyEntryMarkerAppliesOnDate(asImportEntry(candidate), date)).toBe(true);
    }
  });

  it('keeps the undated 5h Health Promotion e-learning requirement as source information, not a fake event', () => {
    expect(VERIFIED_STUDY_CURRENT_UNDATED_REQUIREMENTS_2026_10_08).toEqual([
      expect.objectContaining({ sourceRange: 'A20', subject: 'PROMOCJA ZDROWIA', activityType: 'E-learning', declaredTeachingHours: 5 }),
    ]);
  });

  it('overrides parser calendar fields with the manual snapshot for the exact current source key', () => {
    const manual = VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_08.find((candidate) => candidate.sourceKey.includes('|2026-10-08|16:30|18:00|CHIRURGIA'))!;
    const deliberatelyWrong: StudyScheduleCandidate = {
      ...manual,
      date: '2026-10-09',
      startTime: '09:00',
      endTime: '10:00',
      room: 'BŁĘDNA SALA',
      address: 'BŁĘDNY ADRES',
      warnings: ['synthetic parser drift'],
      manuallyReviewed: false,
    };
    const analysis: ScheduleAnalysis = {
      adapterId: 'nursing-week-matrix-v2',
      sheetNames: ['PLAN ZAJĘĆ', 'WYKŁADY'],
      groups: ['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'],
      candidates: [deliberatelyWrong],
      information: [],
      warnings: [],
    };
    const corrected = applyVerifiedStudyPlanManualCorrectionsToAnalysis(analysis, VERIFIED_STUDY_PLAN_2026_10_08.sha256).candidates[0]!;
    expect(corrected).toMatchObject({
      date: '2026-10-08', startTime: '16:30', endTime: '18:00',
      subject: 'CHIRURGIA', room: 'AULA A', address: 'ul. Trojdena 2a', status: 'READY', include: true,
      manuallyReviewed: true,
    });
    expect(corrected.warnings).toEqual([]);
  });
});
