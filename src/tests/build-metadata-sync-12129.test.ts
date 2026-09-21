import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const versionSource = readFileSync('src/core/version.ts', 'utf8');
const buildSource = readFileSync('src/core/build.ts', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const buildInfo = existsSync('BUILD_INFO.json')
  ? JSON.parse(readFileSync('BUILD_INFO.json', 'utf8')) as {
      appVersion: string;
      packageVersion: string;
      build: string;
    }
  : null;

const appVersion = /APP_VERSION\s*=\s*'([^']+)'/u.exec(versionSource)?.[1];
const appBuild = /APP_BUILD\s*=\s*'([^']+)'/u.exec(buildSource)?.[1];

describe('build metadata synchronization', () => {
  it('keeps visible build number synchronized across source and package metadata', () => {
    expect(appVersion).toMatch(/^\d+\.\d+\.\d+\.\d+$/u);
    const parts = appVersion!.split('.');
    expect(appBuild).toBe(parts[3]);
    const releaseVersion = parts.slice(0, 3).join('.');
    const expectedPackageVersion = `${releaseVersion}-private.${appBuild}`;
    expect(packageJson.version).toBe(expectedPackageVersion);

    if (buildInfo) {
      expect(buildInfo.appVersion).toBe(appVersion);
      expect(buildInfo.build).toBe(appBuild);
      expect(buildInfo.packageVersion).toBe(expectedPackageVersion);
    }
  });
});
