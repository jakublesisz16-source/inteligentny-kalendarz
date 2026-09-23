import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const work = readFileSync(new URL('../work/WorkView.tsx', import.meta.url), 'utf8');
const coworkers = readFileSync(new URL('../work/CoworkerOverlapList.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');

describe('Build209 real-phone polish', () => {
  it('fits the full mobile week timeline instead of requiring hour-by-hour scrolling', () => {
    expect(calendar).toContain('WEEK_MOBILE_VERTICAL_CHROME');
    expect(calendar).toContain('if (weekHourHeight <= 32)');
    expect(calendar).toContain('data-hour={WEEK_START_HOUR + index}');
    expect(css).toContain('Calendar week: the whole 06:00-23:00 range fits in one phone viewport');
    expect(css).toContain('overflow-y: hidden');
  });

  it('keeps Finance first surfaces low-noise on phones', () => {
    expect(finance).toContain("{comparison.state === 'comparable' ? <small");
    expect(finance).toContain('finance-trip-currency-compact');
    expect(css).toContain('.finance-trip-dashboard-v148 .finance-trip-metric-grid');
    expect(css).toContain('display: none;');
  });

  it('makes expanded Work teammates scan as one compact line each', () => {
    expect(work).toContain('<summary>{formatPersonCount(coworkers.length)}</summary>');
    expect(coworkers).toContain('coworker-compact-time');
    expect(coworkers).toContain('· razem');
    expect(css).toContain('.work-roster-direct .work-shift-main-line small { display: none; }');
  });
});
