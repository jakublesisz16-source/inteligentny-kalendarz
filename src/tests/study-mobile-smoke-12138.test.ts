import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const smoke = readFileSync('scripts/study-mobile-smoke.mjs', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> };

describe('1.2.0.146 Study mobile release smoke', () => {
  it('runs the active study import on both release mobile viewports', () => {
    expect(smoke).toContain('runStudySmoke(cdp, 390, 844)');
    expect(smoke).toContain('runStudySmoke(cdp, 360, 800)');
    expect(smoke).toContain("await cdp.send('DOM.setFileInputFiles'");
  });

  it('checks the exact group model and does not expose G8 when G4 is available', () => {
    expect(smoke).toContain("main: args.get('main') || process.env.STUDY_MAIN || ''");
    expect(smoke).toContain("g12: args.get('g12') || process.env.STUDY_G12 || ''");
    expect(smoke).toContain("g4: args.get('g4') || process.env.STUDY_G4 || ''");
    expect(smoke).not.toContain("'MAIN:10'");
    expect(smoke).not.toContain("'G12:10A'");
    expect(smoke).not.toContain("'G4:10B2'");
    expect(smoke).toContain('Grupa 8-osobowa');
    expect(smoke).toContain("fail('G8 jest nadal ręcznym wyborem mimo dostępnego G4')");
  });

  it('verifies preview counts, committed IndexedDB events and Calendar handoff', () => {
    expect(smoke).toContain("args.get('events') || process.env.STUDY_EVENTS || ''");
    expect(smoke).toContain("args.get('incomplete') || process.env.STUDY_INCOMPLETE || ''");
    expect(smoke).toContain("indexedDB.open('inteligentny-kalendarz')");
    expect(smoke).toContain("event?.source === 'UNIVERSITY_XLSX'");
    expect(smoke).toContain("clickMobileNav(cdp, 'Kalendarz')");
    expect(smoke).toContain('STUDY_MOBILE_SMOKE_ALL_OK');
  });

  it('waits for real app bootstrap and closes the ready splash before clicking Study', () => {
    expect(smoke).toContain('async function waitForAppShell');
    expect(smoke).toContain("document.querySelector('.app-shell')");
    expect(smoke).toContain("document.querySelector('.startup-screen .error-card p')");
    expect(smoke).toContain("new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })");
    expect(smoke).toContain('await waitForAppShell(cdp)');
    expect(smoke).toContain("document.querySelectorAll('.bottom-nav-item, .nav-item')");
  });

  it('is exposed as an explicit package command rather than hidden release behavior', () => {
    expect(packageJson.scripts?.['study:mobile-smoke']).toBe('node scripts/study-mobile-smoke.mjs');
  });


  it('cleans up Chromium safely on Windows without masking the smoke result', () => {
    expect(smoke).toContain("await cdp.send('Browser.close')");
    expect(smoke).toContain("spawnSync('taskkill', ['/PID', String(browserProcess.pid), '/T', '/F']");
    expect(smoke).toContain('maxRetries: 12');
    expect(smoke).toContain('STUDY_MOBILE_SMOKE_CLEANUP_WARN');
    expect(smoke).toContain('await shutdownBrowser(browserProcess, cdp, profile)');
  });
});
