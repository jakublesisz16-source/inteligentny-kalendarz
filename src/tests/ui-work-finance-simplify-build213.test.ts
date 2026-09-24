import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Build213 Work and Finance simplification', () => {
  it('keeps the Work roster aligned as one bounded desktop column', () => {
    const css = read('src/styles/interface-refinement.css');
    expect(css).toContain('/* Build213 - Work desktop alignment + Finance Items simplification after real-device QA. */');
    expect(css).toContain('width: min(100%, 900px);');
    expect(css).toContain('max-height: none;');
  });

  it('keeps whole-row Work expansion and one controlled open shift', () => {
    const work = read('src/work/WorkView.tsx');
    expect(work).toContain('work-shift-row-trigger');
    expect(work).toContain('expandedShiftId');
    expect(work).toContain('current === event.id ? null : event.id');
  });

  it('turns Finance Items into a phone review list without removing editing controls', () => {
    const finance = read('src/finance/FinanceDashboardView.tsx');
    const css = read('src/styles/interface-refinement.css');
    expect(finance).toContain('finance-purchase-category-column');
    expect(finance).toContain('finance-purchase-necessity-column');
    expect(finance).toContain('finance-category-select');
    expect(finance).toContain('finance-necessity-select');
    expect(css).toContain("'product money'");
    expect(css).toContain("'category necessity'");
  });

  it('removes duplicate mobile filter chrome while preserving the filter panel', () => {
    const finance = read('src/finance/FinanceDashboardView.tsx');
    const css = read('src/styles/interface-refinement.css');
    expect(finance).toContain('finance-purchase-filter-panel');
    expect(finance).toContain('Filtry');
    expect(css).toMatch(/\.finance-expense-section-v177 \.finance-review-strip,[\s\S]*?\.finance-expense-section-v177 \.finance-quick-filters \{\s*display: none;/u);
  });
});
