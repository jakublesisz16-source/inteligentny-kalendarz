import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const versionSource = readFileSync('src/core/version.ts', 'utf8');
const buildSource = readFileSync('src/core/build.ts', 'utf8');
const hasPrivateCheckpointMetadata = ['CURRENT_PROJECT_RULES.md', 'CURRENT_STATE.json', 'BUILD_INFO.json']
  .every((path) => existsSync(path));
const rules = hasPrivateCheckpointMetadata ? readFileSync('CURRENT_PROJECT_RULES.md', 'utf8') : null;
const state = hasPrivateCheckpointMetadata
  ? JSON.parse(readFileSync('CURRENT_STATE.json', 'utf8')) as {
      version: string;
      releaseVersion: string;
      build: number;
      versionScheme: string;
      versionPolicy?: Record<string, string>;
    }
  : null;
const buildInfo = hasPrivateCheckpointMetadata
  ? JSON.parse(readFileSync('BUILD_INFO.json', 'utf8')) as {
      appVersion: string;
      releaseVersion: string;
      build: string;
      versionScheme: string;
    }
  : null;

describe('project versioning workflow', () => {
  it('uses numeric MAJOR.MINOR.STAGE.BUILD and keeps available metadata synchronized', () => {
    const appVersion = /APP_VERSION\s*=\s*'([^']+)'/u.exec(versionSource)?.[1];
    const appBuild = /APP_BUILD\s*=\s*'([^']+)'/u.exec(buildSource)?.[1];
    expect(appVersion).toMatch(/^\d+\.\d+\.\d+\.\d+$/u);
    const parts = appVersion!.split('.');
    expect(appBuild).toBe(parts[3]);

    if (state && buildInfo) {
      expect(state.version).toBe(appVersion);
      expect(String(state.build)).toBe(appBuild);
      expect(state.releaseVersion).toBe(parts.slice(0, 3).join('.'));
      expect(buildInfo.appVersion).toBe(appVersion);
      expect(buildInfo.releaseVersion).toBe(state.releaseVersion);
      expect(buildInfo.build).toBe(appBuild);
      expect(state.versionScheme).toBe('MAJOR.MINOR.STAGE.BUILD');
      expect(buildInfo.versionScheme).toBe('MAJOR.MINOR.STAGE.BUILD');
    }
  });

  it('keeps the simple increment/reset policy in the private checkpoint when present', () => {
    if (!state || !rules) return;
    expect(state.versionPolicy).toMatchObject({
      normalUpdate: 'increment-build',
      stageUpdate: 'increment-stage-reset-build-0',
      minorUpdate: 'increment-minor-reset-stage-build-0',
      majorUpdate: 'increment-major-reset-minor-stage-build-0',
      noFileChange: 'keep-version',
    });
    expect(rules).toContain('Format projektu jest stały: `MAJOR.MINOR.STAGE.BUILD`');
    expect(rules).toContain('`BUILD` nie ma limitu 99');
    expect(rules).toContain('sama rozmowa, analiza lub test bez trwałej zmiany plików projektu nie zmienia numeru');
  });
});
