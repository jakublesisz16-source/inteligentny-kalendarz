import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const today = readFileSync(new URL('../calendar/TodayView.tsx', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const consistency = readFileSync(new URL('../planning/consistency.ts', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build272 compact Today and Finance polish', () => {
  it('removes the persistent academic legend while preserving day-level context', () => {
    expect(calendar).not.toContain('calendar-academic-legend');
    expect(calendar).toContain('dayToneClass');
    expect(calendar).toContain('overlayMarkers.map((marker) => marker.label)');
  });

  it('uses one gentle commute wording without exposing ETA or internal minutes', () => {
    expect(consistency).toContain("title: 'Mało czasu na dojazd'");
    expect(consistency).toContain("description: 'Przerwa między wydarzeniami może być krótka na dojazd.'");
    expect(consistency).not.toContain("title: clearlyTooShort ? 'Za mało czasu na dojazd'");
  });

  it('adds weekday context to a future Today preview and keeps the empty day in one compact surface', () => {
    expect(today).toContain("weekday: 'long'");
    expect(refinement).toContain('Build272 - bounded polish for Calendar, Today and Finance');
    expect(refinement).toContain('grid-template-columns: minmax(220px, .72fr) minmax(0, 1.28fr);');
    expect(refinement).toContain('border-left: 1px solid');
  });

  it('keeps + Wydatek primary and Skanuj paragon secondary in an empty month', () => {
    expect(finance).not.toContain('!isEmptyMonth ? <button type="button" className="button button-primary finance-manual-expense"');
    expect(finance).toContain('className="button button-primary finance-manual-expense"');
    expect(finance).toContain('className="button button-secondary finance-scan-receipt"');
    expect(finance).toContain('Po pierwszym wydatku pojawi się podsumowanie miesiąca.');
    expect(responsive).toContain('Build272 - empty Month keeps the same primary action hierarchy');
  });

  it('keeps database schema 14', () => {
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
