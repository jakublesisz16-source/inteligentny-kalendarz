import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.76 mobile week resize hardening', () => {
  it('keeps the resize hit area inside the event footprint', () => {
    expect(responsive).toContain('/* 1.2.0.76 - keep the mobile resize hit area inside its own event */');
    expect(responsive).toContain('bottom: 0;');
    expect(responsive).toContain('height: min(18px, 100%);');
    expect(responsive).not.toContain('bottom: -7px;');
  });

  it('clears a resize session if pointer capture is unexpectedly lost', () => {
    expect(calendar).toContain('function handleWeekResizeLostPointerCapture');
    expect(calendar).toContain('onLostPointerCapture={handleWeekResizeLostPointerCapture}');
    expect(calendar).toContain('weekResizeSessionRef.current = null;');
  });

  it('clears the session before releasing pointer capture on normal completion', () => {
    const finishStart = calendar.indexOf('async function finishWeekResize');
    const finishEnd = calendar.indexOf('function cancelWeekResize', finishStart);
    const finish = calendar.slice(finishStart, finishEnd);
    expect(finish.indexOf('weekResizeSessionRef.current = null;')).toBeGreaterThanOrEqual(0);
    expect(finish.indexOf('weekResizeSessionRef.current = null;')).toBeLessThan(finish.indexOf('releasePointerCapture'));
  });

  it('keeps database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
