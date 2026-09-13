import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.94 mobile empty Finance actions', () => {
  it('keeps receipt scanning reachable in an empty month while removing only the duplicate manual expense action', () => {
    expect(dashboard).toContain('className="button button-primary finance-manual-expense"');
    expect(dashboard).toContain('className="button button-secondary finance-scan-receipt"');
    expect(responsive).toContain('.finance-month-is-empty > .finance-dashboard-controls-v1258 .finance-manual-expense');
    expect(responsive).not.toContain('.finance-month-is-empty > .finance-dashboard-controls-v1258 .finance-core-actions,');
  });

  it('still hides the duplicated full header action group for an empty active trip because the trip empty card owns both actions', () => {
    expect(dashboard).toContain('finance-trip-is-empty');
    expect(dashboard).toContain('finance-trip-empty');
    expect(responsive).toContain('.finance-trip-is-empty > .finance-dashboard-controls-v1258 .finance-core-actions');
  });

  it('keeps the checkpoint and database schema synchronized', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
