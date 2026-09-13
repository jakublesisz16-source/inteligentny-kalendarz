import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.95 mobile empty-month scanner cascade', () => {
  it('re-enables Skanuj paragon after the older compact rule hides scanners on mobile', () => {
    const genericHide = responsive.indexOf('.finance-dashboard-controls-v1258 .finance-core-actions .finance-scan-receipt { display: none; }');
    const emptyMonthShow = responsive.indexOf('.finance-month-is-empty > .finance-dashboard-controls-v1258 .finance-core-actions .finance-scan-receipt');
    expect(genericHide).toBeGreaterThan(-1);
    expect(emptyMonthShow).toBeGreaterThan(genericHide);
    expect(responsive.slice(emptyMonthShow, emptyMonthShow + 220)).toContain('display: inline-flex;');
  });

  it('keeps the database schema unchanged', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
