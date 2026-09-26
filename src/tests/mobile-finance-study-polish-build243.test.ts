import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const study = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build243 mobile Finance Items + Study current-plan polish', () => {
  it('uses one canonical two-row Finance item layout on phones', () => {
    expect(refinement).toContain('Build243 - canonical mobile Finance Items + Study current-plan polish');
    expect(refinement).toContain("'product money details'");
    expect(refinement).toContain("'category necessity necessity'");
    expect(refinement).not.toContain("'merchant date date'");
    expect(refinement).toContain('-webkit-line-clamp: 2;');
  });

  it('keeps source/date and quantity context inside the product cell instead of extra mobile table rows', () => {
    expect(finance).toContain('finance-purchase-mobile-context');
    expect(finance).toContain('finance-purchase-mobile-unit');
    expect(refinement).toContain('.finance-purchase-merchant-column,');
    expect(refinement).toContain('.finance-purchase-unit-column,');
    expect(refinement).toContain('.finance-purchase-date-column');
    expect(refinement).toContain('display: none;');
  });

  it('stacks the current Study plan and upload action on narrow phones without text/button collisions', () => {
    expect(study).toContain('study-current-plan-line');
    expect(study).toContain("activeImport ? 'Wczytaj nowy' : 'Wczytaj plan'");
    expect(refinement).toContain('.study-view .study-upload-dashboard {');
    expect(refinement).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(refinement).toContain('.study-view .study-upload-action {');
    expect(refinement).toContain('justify-content: flex-start;');
    expect(refinement).toContain('.study-current-plan-change {');
    expect(refinement).toContain('width: fit-content;');
  });

  it('keeps the 1.2.0 release line and schema 14', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'1\.2\.0\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
