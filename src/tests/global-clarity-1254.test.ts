import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/app/App.tsx', 'utf8');
const navigation = readFileSync('src/ui/Navigation.tsx', 'utf8');
const today = readFileSync('src/calendar/TodayView.tsx', 'utf8');
const eventCard = readFileSync('src/events/EventCard.tsx', 'utf8');
const finance = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const settings = readFileSync('src/settings/SettingsView.tsx', 'utf8');
const work = readFileSync('src/work/WorkView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');
const build = readFileSync('src/core/build.ts', 'utf8');

describe('1.2.0.54 global clarity pass', () => {
  it('keeps visible global search out of the primary interface', () => {
    expect(app).not.toContain('className="global-search-utility"');
    expect(navigation).not.toContain('nav-search-item');
    expect(navigation).not.toContain('bottom-nav-search');
  });

  it('keeps Today concise while preserving the complete coworker context', () => {
    expect(today).toContain('today-add-button');
    expect(today).toContain('showAllWorkCoworkers');
    expect(today).toContain('compactTimeRange');
    expect(today).not.toContain('<h2>Plan dnia</h2>');
    expect(eventCard).not.toContain('event-coworker-mobile-more');
  });

  it('keeps Finance and Work focused on primary information', () => {
    expect(finance).toContain('>Dodaj</button>');
    expect(finance).toContain('Brak wydatków w');
    expect(work).toContain('nearestCoworkers.map((person)');
    expect(work).not.toContain('nearestCoworkers.slice(0, 5)');
  });

  it('keeps Settings simple: essentials, visible install/backup tools and a compact build line', () => {
    expect(settings).toContain('settings-essential-grid');
    expect(settings).toContain('settings-build-line');
    expect(settings).toContain('Backup i przenoszenie');
    expect(settings).toContain('Dane i historia');
    expect(settings).not.toContain('settings-advanced-collapsible');
    expect(settings).toContain('Wersja {APP_RELEASE_VERSION}');
    expect(settings).toContain('Build {BUILD_NUMBER}');
    expect(css).toContain('/* 1.2.0.54 - global clarity pass');
    expect(responsive).toContain('/* 1.2.0.54 - real-device mobile clarity pass */');
  });

  it('keeps the database schema stable and build metadata separated', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).not.toContain('APP_BUILD');
    expect(build).toContain("APP_BUILD = '112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
