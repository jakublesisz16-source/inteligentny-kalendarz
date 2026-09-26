import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const refinement = readFileSync('src/styles/interface-refinement.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('Build221 Finance donut legend alignment polish', () => {
  it('adds isolated Build221 month and trip dashboard hooks', () => {
    expect(dashboard).toContain('finance-month-dashboard-v221');
    expect(dashboard).toContain('finance-trip-dashboard-v221');
  });

  it('renders compact desktop legend rows as marker icon label and values', () => {
    expect(refinement).toContain('grid-template-columns: 9px 23px minmax(0, 1fr) minmax(96px, auto);');
    expect(refinement).toContain('grid-template-columns: 34px minmax(55px, auto);');
    expect(refinement).toContain('width: 8px;\n  height: 8px;\n  border-radius: 50%;');
  });

  it('keeps mobile values readable without widening the dashboard', () => {
    expect(refinement).toContain('@media (max-width: 620px)');
    expect(refinement).toContain('grid-template-columns: 7px 18px minmax(0, 1fr) auto;');
    expect(refinement).toContain('grid-template-columns: 1fr;\n    gap: 0;');
  });

  it('keeps the foreign-currency PLN context as a dedicated legend subtitle', () => {
    expect(dashboard).toContain('finance-trip-category-currency-note-v221');
    expect(dashboard).toContain('Udział kategorii · kwoty w PLN');
    expect(refinement).toContain('.finance-trip-dashboard-v221 .finance-trip-category-currency-note-v221');
  });

  it('does not change the database schema', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'1\.2\.0\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
