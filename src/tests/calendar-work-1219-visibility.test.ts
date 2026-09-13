import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workView = readFileSync('src/work/WorkView.tsx', 'utf8');
const calendarView = readFileSync('src/calendar/CalendarView.tsx', 'utf8');

describe('1.2.0.19 visibility consistency', () => {
  it('shows all coworkers in the nearest shift card', () => {
    expect(workView).toContain('const nearestCoworkers = useMemo(() => nearestEvent ? sortCoworkerOverlaps(coworkersByEvent[nearestEvent.id] ?? []) : []');
    expect(workView).not.toContain(".slice(0,3).map((person)");
  });

  it('shows all selected Study groups directly in Calendar', () => {
    expect(calendarView).toContain('Plan studiów aktywny');
    expect(calendarView).toContain('Wybrane grupy aktywnego planu');
    expect(calendarView).toContain('activeStudyGroups.map((group) => <span key={group} title={studyGroupDisplayLabel(group)}>{studyGroupDisplayLabel(group)}</span>)');
    expect(calendarView).toContain('calendar-week-study-group');
    expect(calendarView).toContain('studyEventDisplay(event).groupLabel');
  });
});
