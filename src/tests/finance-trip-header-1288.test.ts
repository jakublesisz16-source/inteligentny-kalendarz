import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const finance = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.88 trip-list action hierarchy', () => {
  it('keeps trip creation inside the trips list header instead of the global toolbar', () => {
    expect(finance).toContain('finance-trips-heading-actions');
    expect(finance).toContain('finance-new-trip-header-button');
    expect(finance).not.toContain("financeScope === 'TRIPS' && !activeTripName ? <button type=\"button\" className=\"button button-secondary\"");
  });

  it('keeps an explicit empty-state CTA while retaining the compact header action', () => {
    expect(finance).toContain('finance-trip-empty-list');
    expect(finance).toContain('Utwórz pierwszy wyjazd, a jego wydatki będą zebrane w jednym miejscu.');
    expect(finance).toContain('>+ Wyjazd</button>');
  });

  it('keeps the header action compact on desktop and mobile', () => {
    expect(css).toContain('/* 1.2.0.88 - trip creation belongs to the trip-list heading');
    expect(responsive).toContain('/* 1.2.0.88 - trip-list header action stays compact on phones */');
  });

  it('keeps schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
