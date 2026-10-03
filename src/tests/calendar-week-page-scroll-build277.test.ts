import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const refinement = readFileSync('src/styles/interface-refinement.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('Build277 mobile Week natural page scroll', () => {
  it('removes the nested vertical timeline scroller', () => {
    expect(refinement).toContain('Build277 - mobile Week uses one natural page scroll');
    expect(refinement).toContain('height: auto !important;');
    expect(refinement).toContain('overflow-y: visible !important;');
    expect(refinement).toContain('touch-action: pan-y;');
    expect(responsive).toContain('the page owns vertical scrolling, not a nested timeline viewport');
  });

  it('does not bind local Week scroll cancellation or auto-scroll anymore', () => {
    expect(calendar).not.toContain('onScroll={handleMobileWeekScroll}');
    expect(calendar).not.toContain('function handleMobileWeekScroll()');
    expect(calendar).not.toContain('startScrollTop:');
    expect(calendar).not.toContain('container.scrollTop =');
  });

  it('keeps long-press drag and resize usable by scrolling the page near viewport edges', () => {
    expect(calendar).toContain("window.scrollBy({ top: -18, behavior: 'auto' })");
    expect(calendar).toContain("window.scrollBy({ top: 18, behavior: 'auto' })");
    expect(calendar).toContain('Math.abs(window.scrollY - session.startWindowScrollY) > 1');
  });

  it('keeps database schema 14', () => {
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
