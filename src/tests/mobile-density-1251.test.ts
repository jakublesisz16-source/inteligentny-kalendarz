import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/app/App.tsx', 'utf8');
const navigation = readFileSync('src/ui/Navigation.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const work = readFileSync('src/work/WorkView.tsx', 'utf8');
const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const today = readFileSync('src/calendar/TodayView.tsx', 'utf8');
const settings = readFileSync('src/settings/SettingsView.tsx', 'utf8');
const visualQa = readFileSync('scripts/visual-qa-capture.mjs', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.53 mobile density pass', () => {
  it('keeps visible global search out of mobile navigation and screen headers', () => {
    expect(navigation).not.toContain('bottom-nav-search');
    expect(navigation).not.toContain('onSearch');
    expect(app).not.toContain('onSearch={() => setSearchOpen(true)}');
    expect(responsive).toContain('/* 1.2.0.60 - compact mobile headers */');
  });

  it('keeps core mobile views compact and protects important actions', () => {
    expect(responsive).toContain('/* 1.2.0.53 - mobile density and viewport-first core screens */');
    expect(responsive).toContain('.work-settings-save-footer');
    expect(responsive).toContain('position: sticky');
    expect(responsive).toContain('.calendar-side-column.is-empty { display: none; }');
    expect(calendar).toContain('weekScrollRef');
    expect(today).toContain('actionLabel="+ Dodaj"');
    expect(settings).toContain('<h1>Ustawienia</h1>');
    expect(work).toContain('work-settings-button-label');
  });

  it('extends visual QA to all main mobile screens', () => {
    expect(visualQa).toContain('today-mobile-390x844.png');
    expect(visualQa).toContain('calendar-month-mobile-390x844.png');
    expect(visualQa).toContain('finance-mobile-390x844.png');
    expect(visualQa).toContain('work-mobile-390x844.png');
    expect(visualQa).toContain('settings-mobile-390x844.png');
  });

  it('keeps the database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
