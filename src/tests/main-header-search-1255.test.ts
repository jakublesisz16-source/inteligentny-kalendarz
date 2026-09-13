import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/app/App.tsx', 'utf8');
const navigation = readFileSync('src/ui/Navigation.tsx', 'utf8');
const today = readFileSync('src/calendar/TodayView.tsx', 'utf8');
const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const finance = readFileSync('src/finance/FinanceView.tsx', 'utf8');
const study = readFileSync('src/study/StudyView.tsx', 'utf8');
const work = readFileSync('src/work/WorkView.tsx', 'utf8');
const settings = readFileSync('src/settings/SettingsView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.60 hidden global search and clean headers', () => {
  it('removes visible global search controls from all main views and navigation', () => {
    expect(navigation).not.toContain('onSearch');
    expect(navigation).not.toContain('nav-search-item');
    expect(navigation).not.toContain('bottom-nav-search');
    for (const source of [today, calendar, finance, study, work, settings]) {
      expect(source).not.toContain('HeaderSearch');
      expect(source).not.toContain('onSearch');
    }
  });

  it('keeps the underlying search mechanism available only through a non-visual desktop shortcut for now', () => {
    expect(app).toContain("event.key.toLowerCase() !== 'k'");
    expect(app).toContain('setSearchOpen(true)');
    expect(app).toContain('<GlobalSearch');
  });

  it('preserves complete coworker context in Today', () => {
    expect(today).toContain('showAllWorkCoworkers');
    expect(today).not.toContain('workCoworkerLimit={4}');
  });

  it('reclaims header space without a schema change', () => {
    expect(css).toContain('/* 1.2.0.60 - visible global search removed, headers reclaim the space */');
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
