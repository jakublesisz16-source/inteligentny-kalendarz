import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const preflight = readFileSync('scripts/release-preflight.mjs', 'utf8').replace(/\r\n?/g, '\n');
const surfaceContract = readFileSync('scripts/public-surface-contract.mjs', 'utf8').replace(/\r\n?/g, '\n');

describe('Build284 channel-aware release preflight', () => {
  it('allows the Sync Preview-only safety command only when the channel identifies itself as sync-preview', () => {
    expect(preflight).toContain("const isSyncPreview = !isPrivate && channelSurface === 'sync-preview'");
    expect(preflight).toContain("if (isSyncPreview) allowedChannelScripts.add('security:sync-preview')");
    expect(preflight).toContain("PUBLIC STABLE contains Sync Preview-only file");
    expect(surfaceContract).not.toContain("'security:sync-preview',\n]);");
  });

  it('requires the bounded Firebase workflow contract on a Sync Preview channel', () => {
    expect(preflight).toContain("'.github/workflows/firebase-sync-preview.yml'");
    expect(preflight).toContain('FIREBASE_SERVICE_ACCOUNT_INTELIGENTNY_KALENDARZ_S_2CFC9');
    expect(preflight).toContain('projectId: inteligentny-kalendarz-s-2cfc9');
  });

  it('passes release preflight on an exact generated channel checkout', () => {
    if (!existsSync('CHANNEL_BUILD_INFO.json')) return;
    const result = spawnSync(process.execPath, ['scripts/release-preflight.mjs'], { encoding: 'utf8' });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
});
