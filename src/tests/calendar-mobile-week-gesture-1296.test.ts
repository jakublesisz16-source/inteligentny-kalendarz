import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.96 mobile week gesture hardening', () => {
  it('attaches the scroll ref required by mobile drag, resize auto-scroll and initial week positioning', () => {
    expect(calendar).toContain('ref={weekScrollRef} className="calendar-week-scroll"');
    expect(calendar).toContain('const scroll = weekScrollRef.current;');
    expect(calendar).toContain("scroll?.querySelector<HTMLElement>('.calendar-week-column.selected')");
  });

  it('cancels a pending long press if the week or page starts scrolling before activation', () => {
    expect(calendar).toContain('startScrollTop: weekScrollRef.current?.scrollTop ?? 0');
    expect(calendar).toContain('startWindowScrollY: window.scrollY');
    expect(calendar).toContain('Math.abs(scrollTop - session.startScrollTop) > 1');
    expect(calendar).toContain('Math.abs(window.scrollY - session.startWindowScrollY) > 1');
    expect(calendar).toContain('onScroll={handleMobileWeekScroll}');
  });

  it('keeps resize explicit while leaving most of the event surface available for normal scrolling', () => {
    expect(responsive).toContain('/* 1.2.0.96 - reduce mobile resize versus scroll conflicts */');
    expect(responsive).toContain('left: 50%;');
    expect(responsive).toContain('right: auto;');
    expect(responsive).toContain('width: min(64px, calc(100% - 16px));');
    expect(responsive).toContain('height: min(18px, 100%);');
    expect(responsive).toContain('touch-action: none;');
  });

  it('records the current private version without changing the database schema', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
