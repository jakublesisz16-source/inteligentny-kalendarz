import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.106 mobile touch targets', () => {
  it('keeps the Today primary add action comfortably tappable', () => {
    expect(css).toContain('.today-plan-panel .today-add-row .today-add-button');
    expect(css).toContain('min-height: 44px !important;');
  });

  it('hardens interactive availability chips and day rules without changing desktop density', () => {
    expect(css).toContain('.availability-time-chip,');
    expect(css).toContain('.availability-proposal-chip,');
    expect(css).toContain('.availability-day-rule-button');
    expect(css).toContain('min-height: 42px;');
    expect(css).toContain('@media (max-width: 620px)');
  });

  it('keeps the database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
