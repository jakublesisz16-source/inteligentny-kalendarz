import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const build = readFileSync('src/core/build.ts', 'utf8');
const settings = readFileSync('src/settings/SettingsView.tsx', 'utf8');

describe('Build187 runtime build metadata export contract', () => {
  it('exports the UI-facing BUILD_NUMBER alias from the technical build source', () => {
    expect(build).toMatch(/export const APP_BUILD = '\d+';/u);
    expect(build).toContain('export const BUILD_NUMBER = APP_BUILD;');
  });

  it('keeps Settings on the UI-facing alias', () => {
    expect(settings).toContain("import { BUILD_NUMBER } from '../core/build';");
    expect(settings).toContain('Build {BUILD_NUMBER}');
    expect(settings).not.toContain('import { APP_BUILD }');
  });
});
