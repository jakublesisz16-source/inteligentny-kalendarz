import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const components = readFileSync(new URL('../styles/components.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const mobileCompact = readFileSync(new URL('../styles/mobile-compact.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build245 minimal status accents', () => {
  it('removes colored left status stripes from consistency cards', () => {
    expect(components).not.toMatch(/\.consistency-card\.impact-(?:blocking|warning)\s*\{[^}]*border-left/u);
    expect(responsive).not.toContain('border-left-width: 3px');
    expect(mobileCompact).not.toContain('border-left-width: 1px');
  });

  it('uses subtle status gradients while keeping neutral card borders', () => {
    expect(components).toContain('.consistency-card.impact-blocking {');
    expect(components).toContain('.consistency-card.impact-warning {');
    expect(components).toContain('linear-gradient(118deg');
    expect(components).toContain('border: 1px solid var(--line);');
  });

  it('removes colored left stripes from Study diff cards too', () => {
    expect(components).not.toContain('border-left-width: 4px');
    expect(components).not.toContain('border-left-color: var(--success)');
    expect(components).not.toContain('border-left-color: var(--danger)');
    expect(components).not.toContain('border-left-color: var(--warning)');
    expect(components).toContain('.diff-card.diff-added {');
    expect(components).toContain('.diff-card.diff-removed {');
    expect(components).toContain('.diff-card.diff-changed {');
  });

  it('keeps release line and schema stable', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'1\.2\.0\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
