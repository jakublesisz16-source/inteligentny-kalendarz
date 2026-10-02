import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../calendar/week-layout.ts', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const components = readFileSync(new URL('../styles/components.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build276 Week conflict marker and mobile ending', () => {
  it('renders one column-level warning per merged overlap range and suppresses duplicate event badges', () => {
    expect(calendar).toContain('buildWeekTimedOverlapMarkers');
    expect(calendar).toContain('calendar-week-overlap-conflict-marker');
    expect(calendar).toContain('const eventConflictBadge = conflict && !position.overlapping;');
    expect(layout).toContain('overlapRangesForGroup');
    expect(layout).toContain('return mergeRanges(ranges);');
    expect(components).toContain('.calendar-week-overlap-conflict-marker');
  });

  it('uses only a small horizontal offset when events start at exactly the same time', () => {
    expect(layout).toContain('sameStartIndex');
    expect(calendar).toContain('Math.min(position.sameStartIndex * 3, 4)');
    expect(calendar).toContain('width: `calc(100% - ${6 + overlapLayerInset}px)`');
  });

  it('removes the mobile axis min-height that caused blank space below 23:00', () => {
    expect(refinement).toContain('Build276 - one overlap warning per shared time range, compact Week ending and bottom-nav safety.');
    expect(refinement).toContain('.calendar-week-time-axis {\n    min-height: 0 !important;');
  });

  it('keeps the consistency section scrollable above the fixed bottom navigation', () => {
    expect(refinement).toContain('margin-bottom: calc(var(--mobile-bottom-nav-clearance) + 12px);');
    expect(refinement).toContain('scroll-margin-bottom: calc(var(--mobile-bottom-nav-clearance) + 16px);');
  });

  it('advances Build276 without changing schema', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.276'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
