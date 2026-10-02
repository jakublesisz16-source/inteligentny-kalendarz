import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build273 real-screen polish', () => {
  it('keeps empty Today as two separate owned cards with a left-aligned location row', () => {
    expect(refinement).toContain('Build273 - real-screen polish');
    expect(refinement).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(refinement).toContain('gap: 10px;');
    expect(refinement).toContain('> .today-future-preview > small');
    expect(refinement).toContain('text-align: left;');
  });

  it('preserves calendar day meaning while a day is selected', () => {
    expect(refinement).toContain('.calendar-day.day-off.selected:not(.multi-selected)');
    expect(refinement).toContain('.calendar-day.session-period.selected:not(.multi-selected)');
    expect(refinement).toContain('.calendar-day.vacation-period.selected:not(.multi-selected)');
  });

  it('uses one deliberate gap between the two empty-month Finance surfaces', () => {
    expect(refinement).toContain('.finance-month-empty-view {');
    expect(refinement).toContain('gap: 12px;');
  });

  it('advances only the build and keeps schema 14', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.275'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
