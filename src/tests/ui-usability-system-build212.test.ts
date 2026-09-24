import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const work = readFileSync(new URL('../work/WorkView.tsx', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');

describe('Build212 usability system', () => {
  it('makes the complete Work shift row the expansion target and keeps one controlled expansion', () => {
    expect(work).toContain('expandedShiftId');
    expect(work).toContain('work-shift-row-trigger');
    expect(work).toContain('setExpandedShiftId((current) => current === event.id ? null : event.id)');
    expect(work).toContain('aria-expanded={expanded}');
  });

  it('remembers Work and Finance navigation context locally', () => {
    expect(work).toContain("WORK_TAB_STORAGE_KEY = 'ik.work.tab'");
    expect(finance).toContain("FINANCE_SCOPE_STORAGE_KEY = 'ik.finance.scope'");
    expect(finance).toContain('localStorage.setItem(FINANCE_SCOPE_STORAGE_KEY, financeScope)');
    expect(finance).toContain("useState<FinanceExpenseListMode>('TRANSACTIONS')");
  });

  it('keeps fixed mobile navigation clear of the last useful content', () => {
    expect(css).toContain('Build212 - usability system');
    expect(css).toContain('padding-bottom: calc(var(--mobile-bottom-nav-clearance) + 24px) !important');
    expect(css).toContain('.work-shift-team-count');
  });
});
