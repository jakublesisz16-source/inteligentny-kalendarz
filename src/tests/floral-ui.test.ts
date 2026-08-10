import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DECORATIVE_BACKGROUND_MODE, normalizeDecorativeBackgroundMode } from '../settings/appearance';

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('floral UI identity', () => {
  it('keeps one existing off/static/animated setting and static default', () => {
    expect(normalizeDecorativeBackgroundMode('off')).toBe('off');
    expect(normalizeDecorativeBackgroundMode('static')).toBe('static');
    expect(normalizeDecorativeBackgroundMode('animated')).toBe('animated');
    expect(DEFAULT_DECORATIVE_BACKGROUND_MODE).toBe('static');
  });

  it('exposes the floral mode once at the app root', () => {
    const app = read('../app/App.tsx');
    expect(app).toContain('data-floral-mode={settings.decorativeBackgroundMode}');
  });

  it('uses shared decorative accents instead of domain-specific copies', () => {
    const app = read('../app/App.tsx');
    const navigation = read('../ui/Navigation.tsx');
    const emptyState = read('../ui/EmptyState.tsx');
    expect(app).toContain('view-floral-accent');
    expect(navigation).toContain('brand-floral-accent');
    expect(emptyState).toContain('empty-floral-accent');
  });

  it('makes all inline floral accents decorative and non-focusable', () => {
    const accent = read('../ui/FloralAccent.tsx');
    expect(accent).toContain('aria-hidden="true"');
    expect(accent).toContain('focusable="false"');
  });

  it('keeps the global off switch authoritative in CSS', () => {
    const layout = read('../styles/layout.css');
    expect(layout).toContain('.app-shell[data-floral-mode="off"] .floral-ui-accent');
    expect(layout).toContain('display: none');
  });
});
