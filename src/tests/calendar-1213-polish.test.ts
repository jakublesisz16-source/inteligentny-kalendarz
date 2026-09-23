import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const consistency = readFileSync('src/planning/ConsistencyCenter.tsx', 'utf8');
const consistencyLogic = readFileSync('src/planning/consistency.ts', 'utf8');
const eventCard = readFileSync('src/events/EventCard.tsx', 'utf8');
const database = readFileSync('src/storage/database.ts', 'utf8');

describe('1.2.0.13 calendar polish', () => {
  it('keeps only one add action for an empty selected day', () => {
    expect(calendar).toContain('actionLabel="+ Dodaj"');
    expect(calendar).toContain('selectedEvents.length || selectedIncompleteStudyEntries.length');
  });

  it('keeps work coworkers visible in the Calendar day panel', () => {
    expect(calendar).toContain('showAllWorkCoworkers');
    expect(eventCard).toContain('showAllWorkCoworkers');
  });

  it('uses a compact Study plan status and clear consistency actions', () => {
    expect(calendar).not.toContain('Plan studiów aktywny');
    expect(consistency).toContain('Edytuj serię');
  });

  it('reuses Work commute time for calendar consistency warnings', () => {
    expect(consistencyLogic).toContain('travelBufferMinutesForEvent');
    expect(consistencyLogic).toContain("title: 'Za mało czasu na dojazd'");
    expect(database).toContain('planningProfile?.defaultBufferMinutes ?? 30');
  });
});
