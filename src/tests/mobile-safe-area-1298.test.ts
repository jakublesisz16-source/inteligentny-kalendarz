import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(path, 'utf8').replace(/\r\n?/g, '\n'); }

const responsive = source('src/styles/responsive.css');
const indexHtml = source('index.html');
const version = source('src/core/version.ts');

describe('1.2.0.98 mobile safe-area clearance', () => {
  it('uses one bottom-navigation clearance that includes the device safe area', () => {
    expect(responsive).toContain('/* 1.2.0.98 - shared safe-area clearance for bottom navigation and mobile PWA edges. */');
    expect(responsive).toContain('--mobile-bottom-nav-clearance: calc(74px + max(8px, env(safe-area-inset-bottom)))');
    expect(responsive).toContain('padding-bottom: calc(var(--mobile-bottom-nav-clearance) + 8px)');
  });

  it('keeps transient bottom UI above navigation instead of covering it', () => {
    expect(responsive).toContain('.toast,\n  .finance-feedback-toast,\n  .sticky-import-actions,\n  .calendar-month-quick-add,');
    expect(responsive).toContain('bottom: var(--mobile-bottom-nav-clearance)');
  });

  it('respects the top and side PWA safe areas when viewport-fit cover is enabled', () => {
    expect(indexHtml).toContain('viewport-fit=cover');
    expect(responsive).toContain('padding-top: max(8px, env(safe-area-inset-top))');
    expect(responsive).toContain('padding-left: max(18px, env(safe-area-inset-left))');
    expect(responsive).toContain('padding-right: max(18px, env(safe-area-inset-right))');
  });

  it('keeps storage schema unchanged', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
