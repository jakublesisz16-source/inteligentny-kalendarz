import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const components = readFileSync(new URL('../styles/components.css', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build275 Week overlap readability', () => {
  it('keeps overlapping Week cards almost full width and renders the shared time as a darker overlay', () => {
    expect(calendar).toContain("width: `calc(100% - ${6 + overlapLayerInset}px)`");
    expect(calendar).toContain('className="calendar-week-event-overlap-zone"');
    expect(calendar).toContain('position.overlapSegments.map');
    expect(components).toContain('.calendar-week-event-overlap-zone');
    expect(refinement).toContain('Build275 - one overlap language on desktop and mobile');
  });

  it('shows both start and end times on every Week event including narrow mobile columns', () => {
    expect(calendar).toContain('data-mobile-time-start={mobileStartTime}');
    expect(calendar).toContain('data-mobile-time-end={mobileEndTime}');
    expect(refinement).toContain('attr(data-mobile-time-start)');
    expect(refinement).toContain('attr(data-mobile-time-end)');
    expect(refinement).toContain('white-space: pre-line;');
  });

  it('keeps the conflict badge away from event text', () => {
    expect(calendar).toContain('className="calendar-week-conflict-badge"');
    expect(components).toContain('.calendar-week-event.conflict > .calendar-week-event-time');
    expect(components).toContain('padding-right: 15px;');
    expect(refinement).toContain('.calendar-week-conflict-badge,');
  });

  it('closes the Week timeline on the explicit end-hour line without internal bottom padding', () => {
    expect(calendar).toContain("className={hour === WEEK_END_HOUR ? 'calendar-week-time-end' : undefined}");
    expect(components).toContain('.calendar-week-time-axis span.calendar-week-time-end');
    expect(refinement).toContain('padding-bottom: 0;');
  });

  it('keeps database schema 14', () => {
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
