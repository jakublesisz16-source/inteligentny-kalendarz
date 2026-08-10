import type { CalendarEvent } from '../events/event.types';
import type { CalendarConsistencyIssue, ConsistencyAcknowledgement, DailyRoutineRule, PlanningImpact } from './planning.types';

function localMs(value: string): number {
  const [date, time = '00:00'] = value.split('T');
  const [y, m, d] = (date ?? '').split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y ?? 1970, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).getTime();
}

function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((localMs(end) - localMs(start)) / 60000));
}

function maxDateTime(a: string, b: string): string { return localMs(a) >= localMs(b) ? a : b; }
function minDateTime(a: string, b: string): string { return localMs(a) <= localMs(b) ? a : b; }

function issueFingerprint(type: string, ids: string[], start: string, end: string): string {
  return [type, ...[...ids].sort(), start, end].join('|');
}

function isBlockingEvent(event: CalendarEvent): boolean {
  if (event.allDay) return event.availabilityImpact === 'BLOCKING';
  return event.availabilityImpact !== 'NON_BLOCKING';
}

function pairTitle(a: CalendarEvent, b: CalendarEvent, studyStudy: boolean): string {
  if (studyStudy) return 'Niespójność planu zajęć';
  if (a.category === 'STUDY' && b.category === 'WORK' || a.category === 'WORK' && b.category === 'STUDY') return 'Konflikt zajęć i pracy';
  if (a.category === 'WORK' && b.category === 'WORK') return 'Nakładające się wydarzenia pracy';
  return 'Nakładające się wydarzenia';
}

function pairDescription(a: CalendarEvent, b: CalendarEvent, minutes: number, studyStudy: boolean): string {
  if (studyStudy) return `${a.title} i ${b.title} nachodzą na siebie przez ${minutes} min. To może wynikać z błędu planu, przypisania grup lub odczytu danych.`;
  return `${a.title} i ${b.title} nachodzą na siebie przez ${minutes} min.`;
}

function makeIssue(input: Omit<CalendarConsistencyIssue, 'id' | 'fingerprint' | 'acknowledged'>, acknowledgements: Set<string>): CalendarConsistencyIssue {
  const fingerprint = issueFingerprint(input.type, [...input.eventIds, ...(input.routineRuleId ? [input.routineRuleId] : [])], input.startDateTime, input.endDateTime);
  return { ...input, id: fingerprint, fingerprint, acknowledged: acknowledgements.has(fingerprint) };
}

function routineIntervals(rule: DailyRoutineRule, rangeStart: Date, rangeEnd: Date): Array<{ start: string; end: string }> {
  if (!rule.active || rule.type !== 'FIXED' || !rule.fixedStart || !rule.fixedEnd) return [];
  const result: Array<{ start: string; end: string }> = [];
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() - 1);
  const final = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());
  while (cursor <= final) {
    if (!rule.daysOfWeek.length || rule.daysOfWeek.includes(cursor.getDay())) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const date = `${y}-${m}-${d}`;
      let endDate = date;
      if (rule.fixedEnd <= rule.fixedStart) {
        const next = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        endDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      }
      result.push({ start: `${date}T${rule.fixedStart}`, end: `${endDate}T${rule.fixedEnd}` });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function analyzeCalendarConsistency(
  events: CalendarEvent[],
  routines: DailyRoutineRule[] = [],
  acknowledgements: ConsistencyAcknowledgement[] = [],
): CalendarConsistencyIssue[] {
  const ack = new Set(acknowledgements.map((item) => item.fingerprint));
  const activeEvents = events.filter(isBlockingEvent).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
  const issues: CalendarConsistencyIssue[] = [];

  for (let i = 0; i < activeEvents.length; i += 1) {
    const a = activeEvents[i]!;
    for (let j = i + 1; j < activeEvents.length; j += 1) {
      const b = activeEvents[j]!;
      if (localMs(b.startDateTime) > localMs(a.endDateTime) && !a.allDay) break;
      if (a.id === b.id) continue;

      if (a.allDay || b.allDay) {
        const allDay = a.allDay ? a : b;
        const other = a.allDay ? b : a;
        const allStart = allDay.startDateTime.slice(0, 10);
        const allEnd = allDay.endDateTime.slice(0, 10);
        const otherStart = other.startDateTime.slice(0, 10);
        const otherEnd = other.endDateTime.slice(0, 10);
        if (otherEnd >= allStart && otherStart <= allEnd) {
          issues.push(makeIssue({
            type: 'ALL_DAY_CONFLICT', planningImpact: 'WARNING', eventIds: [a.id, b.id],
            startDateTime: maxDateTime(a.startDateTime, b.startDateTime), endDateTime: minDateTime(a.endDateTime, b.endDateTime), overlapMinutes: 0,
            categories: [a.category, b.category], sources: [a.source, b.source], title: 'Wydarzenie całodniowe blokuje planowanie',
            description: `${allDay.title} jest oznaczone jako blokujące dzień i pokrywa się z wydarzeniem ${other.title}.`,
          }, ack));
        }
        continue;
      }

      const start = maxDateTime(a.startDateTime, b.startDateTime);
      const end = minDateTime(a.endDateTime, b.endDateTime);
      const overlap = minutesBetween(start, end);
      const touching = localMs(a.endDateTime) === localMs(b.startDateTime) || localMs(b.endDateTime) === localMs(a.startDateTime);

      if (overlap > 0) {
        const studyStudy = a.source === 'UNIVERSITY_XLSX' && b.source === 'UNIVERSITY_XLSX';
        const type = studyStudy ? 'SOURCE_INCONSISTENCY' : 'HARD_OVERLAP';
        const impact: PlanningImpact = 'BLOCKING';
        issues.push(makeIssue({ type, planningImpact: impact, eventIds: [a.id, b.id], startDateTime: start, endDateTime: end, overlapMinutes: overlap,
          categories: [a.category, b.category], sources: [a.source, b.source], title: pairTitle(a, b, studyStudy), description: pairDescription(a, b, overlap, studyStudy) }, ack));

        const workPair = a.category === 'WORK' && b.category === 'WORK';
        const exact = a.startDateTime === b.startDateTime && a.endDateTime === b.endDateTime;
        if (workPair && exact && a.source !== b.source) {
          issues.push(makeIssue({ type: 'POTENTIAL_DUPLICATE', planningImpact: 'WARNING', eventIds: [a.id, b.id], startDateTime: start, endDateTime: end, overlapMinutes: overlap,
            categories: [a.category, b.category], sources: [a.source, b.source], title: 'Możliwy duplikat pracy', description: 'Ręczna praca i grafik PDF mają identyczny przedział. Sprawdź, czy to ten sam obowiązek.' }, ack));
        }
      } else if (touching) {
        const point = localMs(a.endDateTime) === localMs(b.startDateTime) ? a.endDateTime : b.endDateTime;
        issues.push(makeIssue({ type: 'TOUCHING', planningImpact: 'WARNING', eventIds: [a.id, b.id], startDateTime: point, endDateTime: point, overlapMinutes: 0, gapMinutes: 0,
          categories: [a.category, b.category], sources: [a.source, b.source], title: 'Brak buforu między wydarzeniami', description: `${a.title} i ${b.title} stykają się godzinami. Na tym etapie nie uwzględniamy jeszcze dojazdu.` }, ack));
      }
    }
  }

  if (activeEvents.length && routines.length) {
    const minStart = new Date(Math.min(...activeEvents.map((event) => localMs(event.startDateTime))));
    const maxEnd = new Date(Math.max(...activeEvents.map((event) => localMs(event.endDateTime))));
    for (const rule of routines.filter((item) => item.active && item.type === 'FIXED' && item.priority === 'REQUIRED')) {
      for (const interval of routineIntervals(rule, minStart, maxEnd)) {
        for (const event of activeEvents.filter((item) => !item.allDay)) {
          const start = maxDateTime(interval.start, event.startDateTime);
          const end = minDateTime(interval.end, event.endDateTime);
          const overlap = minutesBetween(start, end);
          if (!overlap) continue;
          issues.push(makeIssue({ type: 'ROUTINE_CONFLICT', planningImpact: 'BLOCKING', eventIds: [event.id], routineRuleId: rule.id, startDateTime: start, endDateTime: end, overlapMinutes: overlap,
            categories: [event.category], sources: [event.source], title: `Konflikt z wymaganą czynnością: ${rule.name}`, description: `${event.title} nachodzi na wymaganą czynność „${rule.name}” przez ${overlap} min.` }, ack));
        }
      }
    }
  }

  return issues.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime) || a.type.localeCompare(b.type));
}

export function openPlanningBlockingIssues(issues: CalendarConsistencyIssue[]): CalendarConsistencyIssue[] {
  return issues.filter((issue) => issue.planningImpact === 'BLOCKING' && !issue.acknowledged);
}
