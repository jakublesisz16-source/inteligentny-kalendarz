import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_SPLASH_MIN_VISIBLE_MS, getSplashWaitMs } from '../ui/AppSplash';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(new URL(path, import.meta.url));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('1.1.0-dev.2 FIX2 brand and startup splash contract', () => {
  it('ships one coherent calendar-today brand across favicon and React splash mark', () => {
    const favicon = source('../../public/favicon.svg');
    const mark = source('../ui/AppBrandMark.tsx');
    expect(favicon).toContain('data-brand-mark="calendar-today"');
    expect(mark).toContain('data-brand-mark="calendar-today"');
    expect(favicon).toContain('#cf789b');
    expect(mark).toContain('#cf789b');
  });

  it('reuses the splash calendar mark in the sidebar instead of the IK text tile', () => {
    const navigation = source('../ui/Navigation.tsx');
    const layout = source('../styles/layout.css');
    expect(navigation).toContain("import { AppBrandMark } from './AppBrandMark';");
    expect(navigation).toContain('<AppBrandMark className="brand-mark" size={42} />');
    expect(navigation).not.toContain('>IK</div>');
    expect(layout).toContain('.brand-mark { width: 42px; height: 42px; display: block;');
  });

  it('renders the splash brand mark transparently without the launcher tile background', () => {
    const mark = source('../ui/AppBrandMark.tsx');
    const splash = source('../ui/AppSplash.tsx');
    const styles = source('../styles/components.css');
    expect(mark).not.toContain('<rect width="512" height="512" fill="#f5f3ef" />');
    expect(splash).toContain('<AppBrandMark className="app-splash-mark"');
    expect(styles).toContain('.app-splash-mark { background: transparent; }');
  });

  it('ships correctly sized PWA and Apple icon assets', () => {
    expect(existsSync(new URL('../../public/icon-192-v111.png', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../../public/icon-512-v111.png', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../../public/apple-touch-icon-v111.png', import.meta.url))).toBe(true);
    expect(pngSize('../../public/icon-192-v111.png')).toEqual({ width: 192, height: 192 });
    expect(pngSize('../../public/icon-512-v111.png')).toEqual({ width: 512, height: 512 });
    expect(pngSize('../../public/apple-touch-icon-v111.png')).toEqual({ width: 180, height: 180 });
  });

  it('keeps the manifest wired to local any-maskable assets', () => {
    const manifest = source('../../public/manifest.webmanifest');
    expect(manifest).toContain('./icon-192-v111.png');
    expect(manifest).toContain('./icon-512-v111.png');
    expect(manifest).toContain('"purpose": "any maskable"');
    expect(manifest).toContain('"background_color": "#f5f3ef"');
    expect(manifest).toContain('"theme_color": "#f5f3ef"');
  });

  it('refreshes the offline shell cache for the 1.1.2 security patch', () => {
    const worker = source('../../public/service-worker.js');
    expect(worker).toContain("const CACHE_PREFIX = 'inteligentny-kalendarz-shell-'");
    expect(worker).toContain("const CACHE_NAME = `${CACHE_PREFIX}v1.1.2`");
    expect(worker).toContain('MANDATORY_SHELL_ASSET_PATHS');
    expect(worker).toContain("'favicon.svg'");
    expect(worker).toContain("'icon-192-v111.png'");
    expect(worker).toContain("'icon-512-v111.png'");
    expect(worker).toContain("'apple-touch-icon-v111.png'");
  });

  it('replaces the old technical loading copy with a bootstrap-linked AppSplash', () => {
    const app = source('../app/App.tsx');
    expect(app).toContain("import { AppSplash } from '../ui/AppSplash';");
    expect(app).toContain('return <AppSplash ready={!loading}');
    expect(app).not.toContain('Uruchamiam lokalną bazę danych...');
    expect(app).not.toContain('<div className="startup-mark">IK</div>');
  });

  it('does not add the minimum splash duration after a slow bootstrap', () => {
    expect(APP_SPLASH_MIN_VISIBLE_MS).toBe(750);
    expect(getSplashWaitMs(300, false)).toBe(450);
    expect(getSplashWaitMs(1400, false)).toBe(0);
  });

  it('allows skip to remove only the remaining cosmetic delay', () => {
    expect(getSplashWaitMs(100, true)).toBe(0);
    const splash = source('../ui/AppSplash.tsx');
    expect(splash).toContain('if (completeStartedRef.current || !readyRef.current) return;');
    expect(splash).toContain('if (readyRef.current) completeSplash();');
  });

  it('supports pointer and keyboard skip with listener cleanup', () => {
    const splash = source('../ui/AppSplash.tsx');
    expect(splash).toContain("window.addEventListener('pointerdown', requestSkip");
    expect(splash).toContain("event.key === 'Enter' || event.key === ' ' || event.key === 'Escape'");
    expect(splash).toContain("window.removeEventListener('pointerdown', requestSkip)");
    expect(splash).toContain("window.removeEventListener('keydown', handleKeyDown)");
  });

  it('honors reduced motion without changing readiness semantics', () => {
    const splash = source('../ui/AppSplash.tsx');
    const styles = source('../styles/components.css');
    expect(splash).toContain("'(prefers-reduced-motion: reduce)'");
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('transition-duration: 0s !important');
  });

  it('keeps fatal bootstrap errors reachable after the splash completes', () => {
    const app = source('../app/App.tsx');
    const splashAt = app.indexOf('if (splashVisible)');
    const fatalAt = app.indexOf('if (fatalError || !settings)');
    expect(splashAt).toBeGreaterThan(-1);
    expect(fatalAt).toBeGreaterThan(splashAt);
    expect(app).toContain('Nie udało się uruchomić aplikacji');
    expect(app).toContain('Spróbuj ponownie');
  });

  it('adds no remote runtime, animation dependency or storage migration for branding', () => {
    const splash = source('../ui/AppSplash.tsx');
    const packageJson = source('../../package.json');
    const version = source('../core/version.ts');
    expect(splash).not.toContain('fetch(');
    expect(splash).not.toContain('indexedDB');
    expect(packageJson).not.toContain('lottie');
    expect(packageJson).not.toContain('framer-motion');
    expect(version).toContain("APP_VERSION = '1.1.2'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 13');
  });
});
