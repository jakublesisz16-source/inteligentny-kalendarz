import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('1.2.0.16 calendar add action', () => {
  it('keeps contextual add actions and removes the duplicate header action', () => {
    const calendar = fs.readFileSync(path.join(process.cwd(), 'src/calendar/CalendarView.tsx'), 'utf8');
    expect(calendar).not.toContain('className="calendar-header-actions"');
    expect(calendar).toContain('actionLabel="Dodaj wydarzenie"');
    expect(calendar).toContain('aria-label={`Dodaj wydarzenie');
  });
});
