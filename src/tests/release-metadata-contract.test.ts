import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sourceText } from './helpers/source-text';

interface PrivateState {
  version: string;
  releaseVersion: string;
  build: number;
  versionScheme: string;
  versionPolicy?: Record<string, string>;
}

interface BuildInfo {
  appVersion: string;
  packageVersion: string;
  releaseVersion: string;
  build: string;
  versionScheme: string;
}

function runtimeIdentity() {
  const versionSource = sourceText('src/core/version.ts');
  const buildSource = sourceText('src/core/build.ts');
  const appVersion = /APP_VERSION\s*=\s*'([^']+)'/u.exec(versionSource)?.[1];
  const appBuild = /APP_BUILD\s*=\s*'([^']+)'/u.exec(buildSource)?.[1];
  return { versionSource, buildSource, appVersion, appBuild };
}

describe('release metadata contract', () => {
  it('keeps APP_VERSION, APP_BUILD, package version and service-worker cache synchronized', () => {
    const { versionSource, appVersion, appBuild } = runtimeIdentity();
    expect(appVersion).toMatch(/^\d+\.\d+\.\d+$/u);
    expect(appBuild).toBe(appVersion!.split('.')[2]);
    const packageJson = JSON.parse(sourceText('package.json')) as { version: string };
    expect(packageJson.version).toBe(`${appVersion}-private.${appBuild}`);
    expect(sourceText('public/service-worker.js')).toContain(`v${appVersion}`);
    expect(versionSource).toContain('DATABASE_SCHEMA_VERSION = 14');
  });

  it('exports one UI-facing build alias and Settings uses that alias', () => {
    const { buildSource } = runtimeIdentity();
    const settings = sourceText('src/settings/SettingsView.tsx');
    expect(buildSource).toMatch(/export const APP_BUILD = '\d+';/u);
    expect(buildSource).toContain('export const BUILD_NUMBER = APP_BUILD;');
    expect(settings).toContain("import { BUILD_NUMBER } from '../core/build';");
    expect(settings).toContain('Build {BUILD_NUMBER}');
    expect(settings).not.toContain('import { APP_BUILD }');
  });

  it('keeps available PRIVATE checkpoint identity synchronized without making it a PUBLIC requirement', () => {
    const metadataExists = ['CURRENT_STATE.json', 'BUILD_INFO.json'].every((path) => existsSync(path));
    if (!metadataExists) return;
    const { appVersion, appBuild } = runtimeIdentity();
    const releaseVersion = appVersion; // The release identity is MAJOR.MINOR.PATCH, not the npm prerelease suffix.
    const state = JSON.parse(sourceText('CURRENT_STATE.json')) as PrivateState;
    const buildInfo = JSON.parse(sourceText('BUILD_INFO.json')) as BuildInfo;
    expect(state.version).toBe(appVersion);
    expect(String(state.build)).toBe(appBuild);
    expect(state.releaseVersion).toBe(releaseVersion);
    expect(buildInfo.appVersion).toBe(appVersion);
    expect(buildInfo.build).toBe(appBuild);
    expect(buildInfo.releaseVersion).toBe(releaseVersion);
    expect(buildInfo.packageVersion).toBe(`${appVersion}-private.${appBuild}`);
    expect(state.versionScheme).toBe('MAJOR.MINOR.PATCH');
    expect(buildInfo.versionScheme).toBe('MAJOR.MINOR.PATCH');
  });

  it('keeps the simple increment/reset policy in PRIVATE checkpoints', () => {
    if (!existsSync('CURRENT_STATE.json') || !existsSync('CURRENT_PROJECT_RULES.md')) return;
    const state = JSON.parse(sourceText('CURRENT_STATE.json')) as PrivateState;
    const rules = sourceText('CURRENT_PROJECT_RULES.md');
    expect(state.versionPolicy).toMatchObject({
      normalUpdate: 'increment-patch',
      minorUpdate: 'increment-minor-reset-patch-0',
      majorUpdate: 'increment-major-reset-minor-patch-0',
      noFileChange: 'keep-version',
    });
    expect(rules).toContain('Format projektu jest stały: `MAJOR.MINOR.PATCH`');
    expect(rules).toContain('`PATCH` nie ma limitu 99');
    expect(rules).toContain('sama rozmowa, analiza lub test bez trwałej zmiany plików projektu nie zmienia numeru');
  });
});
