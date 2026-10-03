import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
const ci = readFileSync('.github/workflows/ci.yml', 'utf8').replace(/\r\n?/g, '\n');
const runner = readFileSync('scripts/release-channel-runner.mjs', 'utf8').replace(/\r\n?/g, '\n');
const contract = readFileSync('scripts/channel-contract-gate.mjs', 'utf8').replace(/\r\n?/g, '\n');

describe('Build286 one-host release workflow', () => {
  it('keeps GitHub Pages as the single application hosting path', () => {
    expect(pkg.scripts['release:public']).toContain('release-channel-runner.mjs public');
    expect(pkg.scripts['release:sync']).toBeUndefined();
    expect(pkg.scripts['security:sync-preview']).toBeUndefined();
    expect(ci).toContain('npm run security:public');
    expect(ci).not.toContain('security:sync-preview');
  });

  it('removes Firebase Hosting staging artifacts from PRIVATE', () => {
    expect(existsSync('sync-preview')).toBe(false);
    expect(existsSync('scripts/prepare-sync-preview.mjs')).toBe(false);
    expect(existsSync('.github/workflows/firebase-sync-preview.yml')).toBe(false);
  });

  it('keeps exact PUBLIC build identity and fingerprint protection', () => {
    expect(runner).toContain('RELEASE_REGISTRY_COLLISION');
    expect(runner).toContain("const surface = 'public-stable'");
    expect(contract).toContain("info.surface === 'public-stable'");
    expect(contract).toContain('contentFingerprint');
  });
});
