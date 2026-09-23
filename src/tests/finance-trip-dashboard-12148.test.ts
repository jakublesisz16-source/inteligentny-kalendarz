import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.148 Finance trip dashboard polish', () => {
  it('mirrors the month hierarchy with trip total and lightweight metrics', () => {
    expect(dashboard).toContain('finance-trip-dashboard-v148');
    expect(dashboard).toContain('finance-trip-hero-total');
    expect(dashboard).toContain('<strong>{activeTripName}</strong>');
    expect(dashboard).not.toContain('Wydatki na wyjeździe');
    expect(dashboard).toContain('finance-trip-metric-grid');
    expect(dashboard).toContain('activeTripAverageMinor');
    expect(dashboard).toContain('activeTripCategoryCount');
    expect(dashboard).toContain('finance-trip-metric-action');
  });

  it('ranks the top trip categories with share and amount without changing the data model', () => {
    expect(dashboard).toContain('finance-trip-category-ranking');
    expect(dashboard).toContain('finance-trip-category-grid');
    expect(dashboard).toContain('finance-trip-category-bar');
    expect(dashboard).toContain('entry.sharePercent.toFixed(1)');
    expect(dashboard).toContain('entries.slice(0, 4)');
  });

  it('makes the trips list easier to scan', () => {
    expect(dashboard).toContain('finance-trip-card-v148');
    expect(dashboard).toContain('finance-trip-card-facts');
    expect(dashboard).toContain('finance-trip-card-total');
    expect(css).toContain('/* 1.2.0.148 - Trip Finance mirrors the month dashboard');
  });

  it('keeps the trip hierarchy usable on tablet and phone widths', () => {
    expect(responsive).toContain('/* 1.2.0.148 - Trip dashboard follows the same responsive hierarchy as Month. */');
    expect(responsive).toContain('.finance-trip-dashboard-v148 .finance-trip-dashboard-head');
    expect(responsive).toContain('.finance-trip-category-grid { grid-template-columns: 1fr; }');
    expect(responsive).toContain('.finance-trip-card-v148 .finance-trip-card-total');
  });

  it('keeps schema stable', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
