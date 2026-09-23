import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workView = readFileSync('src/work/WorkView.tsx', 'utf8');
const calendarView = readFileSync('src/calendar/CalendarView.tsx', 'utf8');

describe('1.2.0.19 visibility consistency', () => {
  it('shows all coworkers in the nearest shift card', () => {
    expect(workView).toContain('const nearestCoworkers = useMemo(() => nearestEvent ? sortCoworkerOverlaps(coworkersByEvent[nearestEvent.id] ?? []) : []');
    expect(workView).toContain('nearestCoworkers.map((person)');
    expect(workView).not.toContain('nearestCoworkers.slice(');
  });

  it('keeps Study group labels on actual calendar events without a redundant side summary', () => {
    expect(calendarView).not.toContain('Plan studiów aktywny');
    expect(calendarView).not.toContain('calendar-selected-day-study-context');
    expect(calendarView).toContain('calendar-week-study-group');
    expect(calendarView).toContain('studyEventDisplay(event).groupLabel');
  });
});
