import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.2.0.x simplified product surface', () => {
  it('exposes Finanse as a top-level view and reuses the existing expense engine behind a clean finance facade', () => {
    const app = source('../app/App.tsx');
    const finance = source('../finance/FinanceView.tsx');
    expect(app).toContain("import('../finance/FinanceView')");
    expect(app).toContain("view === 'finance'");
    expect(finance).toContain("import { FinanceDashboardView } from './FinanceDashboardView';");
    expect(finance).toContain('<h1>Finanse</h1>');
    expect(finance).toContain('<FinanceDashboardView />');
  });

  it('does not mount legacy Shopping, Cycle or Locations views in the main application shell', () => {
    const app = source('../app/App.tsx');
    expect(app).not.toContain("import { ShoppingView }");
    expect(app).not.toContain("import { CycleView }");
    expect(app).not.toContain("import { LocationsView }");
    expect(app).not.toContain("view === 'shopping'");
    expect(app).not.toContain("view === 'cycle'");
    expect(app).not.toContain("view === 'locations'");
  });

  it('preserves the legacy modules on disk for deliberate future reactivation', () => {
    expect(existsSync(new URL('../shopping/ShoppingView.tsx', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../cycle/CycleView.tsx', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../locations/LocationsView.tsx', import.meta.url))).toBe(true);
  });

  it('keeps the data schema unchanged because this dev only changes product surface and branding', () => {
    expect(source('../core/version.ts')).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
