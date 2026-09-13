import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('calendar active Study groups preview', () => {
  it('shows every selected group without requiring an expand action', () => {
    const calendar = fs.readFileSync(path.join(process.cwd(), 'src/calendar/CalendarView.tsx'), 'utf8');
    expect(calendar).toContain('Plan studiów aktywny');
    expect(calendar).toContain('Wybrane grupy aktywnego planu');
    expect(calendar).toContain('activeStudyGroups.map((group) =>');
    expect(calendar).toContain('studyGroupDisplayLabel(group)');
    expect(calendar).not.toContain('calendar-study-groups-toggle');
    expect(calendar).not.toContain('showActiveStudyGroups');
    expect(calendar).not.toContain('hidden={!showActiveStudyGroups}');
  });
});
