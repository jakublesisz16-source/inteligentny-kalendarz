import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('calendar Study group information density', () => {
  it('keeps group information on Study events without a redundant active-plan block', () => {
    const calendar = fs.readFileSync(path.join(process.cwd(), 'src/calendar/CalendarView.tsx'), 'utf8');
    expect(calendar).not.toContain('Plan studiów aktywny');
    expect(calendar).not.toContain('calendar-selected-day-study-context');
    expect(calendar).toContain('calendar-week-study-group');
    expect(calendar).toContain('studyGroupLabel');
  });
});
