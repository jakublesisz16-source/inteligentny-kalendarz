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
    expect(appVersion).toMatch(/^\d+\.\d+\.\d+\.\d+$/u);
    expect(appBuild).toBe(appVersion!.split('.')[3]);
    const releaseVersion = appVersion!.split('.').slice(0, 3).join('.');
    const packageJson = JSON.parse(sourceText('package.json')) as { version: string };
    expect(packageJson.version).toBe(`${releaseVersion}-private.${appBuild}`);
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
    const state = JSON.parse(sourceText('CURRENT_STATE.json')) as PrivateState;
    const buildInfo = JSON.parse(sourceText('BUILD_INFO.json')) as BuildInfo;
    const releaseVersion = appVersion!.split('.').slice(0, 3).join('.');
    expect(state.version).toBe(appVersion);
    expect(String(state.build)).toBe(appBuild);
    expect(state.releaseVersion).toBe(releaseVersion);
    expect(buildInfo.appVersion).toBe(appVersion);
    expect(buildInfo.build).toBe(appBuild);
    expect(buildInfo.releaseVersion).toBe(releaseVersion);
    expect(buildInfo.packageVersion).toBe(`${releaseVersion}-private.${appBuild}`);
    expect(state.versionScheme).toBe('MAJOR.MINOR.STAGE.BUILD');
    expect(buildInfo.versionScheme).toBe('MAJOR.MINOR.STAGE.BUILD');
  });

  it('keeps the simple increment/reset policy in PRIVATE checkpoints', () => {
    if (!existsSync('CURRENT_STATE.json') || !existsSync('CURRENT_PROJECT_RULES.md')) return;
    const state = JSON.parse(sourceText('CURRENT_STATE.json')) as PrivateState;
    const rules = sourceText('CURRENT_PROJECT_RULES.md');
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
