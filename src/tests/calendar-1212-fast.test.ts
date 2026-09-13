import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const eventForm = readFileSync('src/events/EventForm.tsx', 'utf8');
const styles = readFileSync('src/styles/components.css', 'utf8');

describe('1.2.0.12 fast calendar UX', () => {
  it('keeps the main calendar focused on month/week, today and four simple filters', () => {
    expect(calendar).toContain("type CalendarDisplayMode = 'MONTH' | 'WEEK'");
    expect(calendar).toContain("{ id: 'ALL', label: 'Wszystko' }");
    expect(calendar).toContain("{ id: 'STUDY', label: 'Studia' }");
    expect(calendar).toContain("{ id: 'WORK', label: 'Praca' }");
    expect(calendar).toContain("{ id: 'MY', label: 'Moje' }");
    expect(calendar).toContain('>Dzisiaj</button>');
  });

  it('supports quick add from an empty hour without changing the database model', () => {
    expect(calendar).toContain('function addAtHour(day: Date, hour: number)');
    expect(calendar).toContain('onClick={() => addAtHour(day, hour)}');
    expect(eventForm).toContain('const initialHasTime = Boolean(initialDate');
    expect(eventForm).toContain("const endDateTime = initialHasTime && initialDate ? (initialEndDate ?? new Date(initialDate.getTime() + 60 * 60 * 1000)) : null;");
  });

  it('renders a compact timeline and subtle conflict markers', () => {
    expect(calendar).toContain('calendar-week-shell');
    expect(calendar).toContain("conflictEventIds.has(event.id) ? ' conflict' : ''");
    expect(styles).toContain('.calendar-week-event.conflict');
  });
});
