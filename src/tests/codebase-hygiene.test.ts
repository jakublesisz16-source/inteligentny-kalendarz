import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const components = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const layout = readFileSync('src/styles/layout.css', 'utf8');
const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
const runner = readFileSync('scripts/release-channel-runner.mjs', 'utf8');

describe('current codebase hygiene', () => {
  it('does not retain CSS for removed Cycle, Shopping or floral UI surfaces', () => {
    for (const css of [components, responsive, layout, tokens]) {
      expect(css).not.toMatch(/\.cycle-/u);
      expect(css).not.toMatch(/\.shopping-/u);
      expect(css).not.toMatch(/floral/u);
      expect(css).not.toContain('--cycle');
    }
  });

  it('keeps one PUBLIC release path and no Firebase Hosting staging artifacts', () => {
    expect(pkg.scripts['release:public']).toBe('node scripts/release-channel-runner.mjs');
    expect(pkg.scripts['release:sync']).toBeUndefined();
    expect(pkg.scripts['security:sync-preview']).toBeUndefined();
    expect(runner).not.toContain("surfaceArg !== 'public'");
    expect(existsSync('sync-preview')).toBe(false);
    expect(existsSync('scripts/prepare-sync-preview.mjs')).toBe(false);
    expect(existsSync('.github/workflows/firebase-sync-preview.yml')).toBe(false);
  });
});
