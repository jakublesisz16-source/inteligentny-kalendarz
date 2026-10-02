import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const work = readFileSync(new URL('../work/WorkView.tsx', import.meta.url), 'utf8');
const coworkers = readFileSync(new URL('../work/CoworkerOverlapList.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');

describe('Build209 real-phone polish', () => {
  it('keeps all seven phone day timelines with a readable vertical scale', () => {
    expect(calendar).toContain('const WEEK_MOBILE_HOUR_HEIGHT = 38;');
    expect(calendar).toContain('if (window.innerWidth <= 620) return WEEK_MOBILE_HOUR_HEIGHT;');
    expect(calendar).toContain('data-hour={hour}');
    expect(css).toContain('Build239 - mobile Week keeps the whole seven-day planner visible');
    expect(css).toContain('Build277 - mobile Week uses one natural page scroll');
    expect(css).toContain('overflow-y: visible !important;');
  });

  it('keeps Finance first surfaces low-noise on phones', () => {
    expect(finance).toContain("{comparison.state === 'comparable' ? <small");
    expect(finance).toContain('finance-trip-currency-compact');
    expect(css).toContain('.finance-trip-dashboard-v148 .finance-trip-metric-grid');
    expect(css).toContain('display: none;');
  });

  it('makes expanded Work teammates scan as one compact line each', () => {
    expect(work.includes('<summary>{formatPersonCount(coworkers.length)}</summary>') || work.includes('work-shift-team-count')).toBe(true);
    expect(coworkers).toContain('coworker-compact-time');
    expect(coworkers).toContain('· razem');
    expect(css).toContain('.work-roster-direct .work-shift-main-line small { display: none; }');
  });
});
