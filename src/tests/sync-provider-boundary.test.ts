import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSyncService, LOCAL_ONLY_SYNC_PROVIDER_ID, resolveSyncProvider } from '../sync';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(?:ts|tsx)$/u.test(name)) out.push(full);
  }
  return out;
}

describe('removable sync provider boundary', () => {
  it('keeps local-only as the safe default without a cloud dependency', async () => {
    const provider = await resolveSyncProvider(LOCAL_ONLY_SYNC_PROVIDER_ID);
    expect(provider.mode).toBe('local-only');
    expect(provider.capabilities).toEqual({ cloud: false, authentication: false });
    expect(await provider.getAccount()).toBeNull();
    expect(await provider.pullLatest()).toBeNull();
    const status = await (await createSyncService(LOCAL_ONLY_SYNC_PROVIDER_ID)).getStatus();
    expect(status.cloudEnabled).toBe(false);
  });

  it('keeps Firebase SDK imports out of application and domain code', () => {
    const offenders = sourceFiles('src')
      .filter((path) => !path.includes('src/tests/'))
      .filter((path) => /from ['"]firebase(?:\/|['"])|import\(['"]firebase(?:\/|['"])/u.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.firebase).toBeUndefined();
  });

  it('uses the existing canonical data-transfer snapshot instead of a second database model', () => {
    const service = readFileSync('src/sync/sync-service.ts', 'utf8');
    expect(service).toContain('createCanonicalDataTransferDocument');
    expect(service).not.toContain('indexedDB.open');
  });
});
