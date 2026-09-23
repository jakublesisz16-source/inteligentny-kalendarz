import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Build201 release contract synchronization', () => {
  it('keeps the concise Build200 copy as the canonical release contract', () => {
    const settings = read('src/settings/SettingsView.tsx');
    const availability = read('src/availability/AvailabilityView.tsx');
    expect(settings).toContain('Kopia i przenoszenie');
    expect(settings).toContain('Historia i odzyskiwanie');
    expect(settings).not.toContain('Backup i przenoszenie');
    expect(availability).toContain('<h3>Automat</h3>');
    expect(availability).toContain('<strong>Wyjątki</strong>');
  });

  it('keeps one save action in Work settings instead of duplicating it', () => {
    const work = read('src/work/WorkView.tsx');
    expect(work).toContain('work-settings-header-save');
    expect(work).not.toContain('work-settings-save-footer');
  });

  it('keeps Build201-or-newer metadata synchronized without changing schema', () => {
    const version = read('src/core/version.ts');
    const build = read('src/core/build.ts');
    const sw = read('public/service-worker.js');
    const versionBuild = Number(version.match(/APP_VERSION = '1\.2\.0\.(\d+)'/)?.[1] ?? 0);
    const buildNumber = Number(build.match(/APP_BUILD = '(\d+)'/)?.[1] ?? 0);
    expect(versionBuild).toBeGreaterThanOrEqual(201);
    expect(buildNumber).toBe(versionBuild);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
    expect(sw).toContain(`v1.2.0.${versionBuild}`);
  });
});
