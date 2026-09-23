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

  it('synchronizes Build201 without changing schema', () => {
    expect(read('src/core/version.ts')).toContain("APP_VERSION = '1.2.0.201'");
    expect(read('src/core/build.ts')).toContain("APP_BUILD = '201'");
    expect(read('src/core/version.ts')).toContain('DATABASE_SCHEMA_VERSION = 14');
    expect(read('public/service-worker.js')).toContain('v1.2.0.201');
  });
});
