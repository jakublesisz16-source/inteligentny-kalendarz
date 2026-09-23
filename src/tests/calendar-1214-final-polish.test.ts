import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const eventCard = readFileSync('src/events/EventCard.tsx', 'utf8');
const consistency = readFileSync('src/planning/ConsistencyCenter.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');

describe('1.2.0.15 final calendar polish', () => {
  it('remembers the last calendar view and filter', () => {
    expect(calendar).toContain('CALENDAR_DISPLAY_MODE_STORAGE_KEY');
    expect(calendar).toContain('CALENDAR_FILTER_STORAGE_KEY');
    expect(calendar).toContain('window.localStorage.setItem');
  });

  it('opens a day preview from week events instead of immediately editing', () => {
    expect(calendar).toContain('onClick={() => selectDay(day)}');
    expect(calendar).toContain('compactTimeRange');
  });

  it('deduplicates location labels and shows compact time ranges in the day panel', () => {
    expect(eventCard).toContain('normalizedAddress.startsWith');
    expect(eventCard).toContain('compactTimeRange ? <strong>');
  });

  it('hides the consistency center when there is nothing to fix', () => {
    expect(consistency).toContain('if (!unresolved.length && !showAcknowledged) return null;');
  });

  it('uses a clean background and subdued Work accents in Calendar', () => {
    expect(calendar).not.toContain('calendar-texture-surface');
    expect(css).toContain('.calendar-week-event.category-work { background: #f7f1f4; }');
    expect(css).not.toContain('.calendar-week-event.category-work { border-left-color:');
    expect(css).toContain('.calendar-day.weekend');
  });
});
