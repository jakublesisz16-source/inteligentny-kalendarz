import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync('index.html', 'utf8');
const main = readFileSync('src/main.tsx', 'utf8');
const recovery = readFileSync('src/app/devServiceWorkerRecovery.ts', 'utf8');
const registration = readFileSync('src/app/registerServiceWorker.ts', 'utf8');
const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.69 mobile LAN stale-worker recovery and calendar tap hardening', () => {
  it('loads a new dev recovery entry before main so an old worker cannot pin the phone to stale Vite modules', () => {
    const recoveryIndex = index.indexOf('/src/app/devServiceWorkerRecovery.ts');
    const mainIndex = index.indexOf('/src/main.tsx');
    expect(recoveryIndex).toBeGreaterThan(0);
    expect(mainIndex).toBeGreaterThan(recoveryIndex);
    expect(recovery).toContain('import.meta.env.DEV');
    expect(recovery).toContain('cleanupDevelopmentServiceWorker');
    expect(registration).toContain('export async function cleanupDevelopmentServiceWorker');
    expect(registration).toContain('registration.unregister()');
    expect(registration).toContain('window.location.reload()');
    expect(main).toContain('registerServiceWorker();');
  });

  it('makes the mobile month quick-add path fail safe to selection only, never direct event creation', () => {
    const start = calendar.indexOf('function openMonthQuickAdd(day: Date)');
    const end = calendar.indexOf('function quickAddInitialDate()', start);
    const block = calendar.slice(start, end);
    expect(block).toContain('setMobileDayPanelOpen(false)');
    expect(block).not.toContain('onAdd(');
    expect(calendar).toContain("window.matchMedia('(max-width: 820px)').matches");
  });

  it('makes the desktop resize grip visibly different from the current-time dot', () => {
    expect(css).toContain('width: 32px;');
    expect(css).toContain('height: 3px;');
    expect(css).toContain('width: 40px;');
    expect(css).toContain('.calendar-week-resize-handle');
  });

  it('keeps database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
