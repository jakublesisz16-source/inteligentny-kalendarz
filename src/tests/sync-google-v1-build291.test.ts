import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyCloudSyncSnapshot,
  createCanonicalDataTransferDocument,
  createEvent,
  createExpenseCategory,
  deleteDatabaseForTests,
  hasMeaningfulDataTransferContent,
  initializeDatabase,
  listEvents,
} from '../storage/database';
import { calculateSyncRevision } from '../sync/sync-service';
import { FIREBASE_GOOGLE_SYNC_PROVIDER_ID, LOCAL_ONLY_SYNC_PROVIDER_ID } from '../sync/provider-ids';
import { resolveSyncProvider } from '../sync/provider-registry';
import { readFileSync } from 'node:fs';

beforeEach(async () => { await deleteDatabaseForTests(); });

describe('Build291 Google Sync V1 foundation', () => {
  it('keeps local-only as default and Firebase as a lazy removable adapter', async () => {
    const local = await resolveSyncProvider(LOCAL_ONLY_SYNC_PROVIDER_ID);
    expect(local.mode).toBe('local-only');
    const registry = readFileSync('src/sync/provider-registry.ts', 'utf8');
    expect(registry).toContain("import('./providers/firebase-google')");
    expect(registry).toContain(FIREBASE_GOOGLE_SYNC_PROVIDER_ID);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.firebase).toBeUndefined();
  });

  it('uses a stable revision that ignores capture time and app-version metadata', async () => {
    await initializeDatabase();
    const document = await createCanonicalDataTransferDocument();
    const changedMetadata = {
      ...document.data,
      appVersion: 'different-build',
      capturedAt: '2099-01-01T00:00:00.000Z',
    };
    expect(await calculateSyncRevision(document.data)).toBe(await calculateSyncRevision(changedMetadata));
  });

  it('recognizes untouched default storage as safe to hydrate from an existing cloud snapshot', async () => {
    await initializeDatabase();
    const document = await createCanonicalDataTransferDocument();
    expect(hasMeaningfulDataTransferContent(document)).toBe(false);
    await createEvent({ title: 'Moje dane', startDateTime: '2026-10-03T18:00', endDateTime: '2026-10-03T19:00', category: 'OTHER' });
    expect(hasMeaningfulDataTransferContent(await createCanonicalDataTransferDocument())).toBe(true);
  });

  it('does not mistake seeded finance categories for user data but detects a custom category', async () => {
    await initializeDatabase();
    expect(hasMeaningfulDataTransferContent(await createCanonicalDataTransferDocument())).toBe(false);
    await createExpenseCategory('Własna kategoria');
    expect(hasMeaningfulDataTransferContent(await createCanonicalDataTransferDocument())).toBe(true);
  });

  it('applies a cloud snapshot exactly without adding a sync journal ping-pong mutation', async () => {
    await initializeDatabase();
    await createEvent({ title: 'Źródło', startDateTime: '2026-10-03T18:00', endDateTime: '2026-10-03T19:00', category: 'OTHER' });
    const cloudDocument = await createCanonicalDataTransferDocument();
    const cloudRevision = await calculateSyncRevision(cloudDocument.data);

    await createEvent({ title: 'Lokalna zmiana do zastąpienia', startDateTime: '2026-10-04T18:00', endDateTime: '2026-10-04T19:00', category: 'OTHER' });
    await applyCloudSyncSnapshot(cloudDocument);

    expect((await listEvents()).map((event) => event.title)).toEqual(['Źródło']);
    const localAfterPull = await createCanonicalDataTransferDocument();
    expect(await calculateSyncRevision(localAfterPull.data)).toBe(cloudRevision);
  });

  it('keeps the Firebase web config isolated and does not restore Firebase Hosting', () => {
    const provider = readFileSync('src/sync/providers/firebase-google.ts', 'utf8');
    const config = readFileSync('src/sync/providers/firebase-google-config.ts', 'utf8');
    const settings = readFileSync('src/sync/SyncSettingsPanel.tsx', 'utf8');
    const sourceHygiene = readFileSync('scripts/source-hygiene-gate.mjs', 'utf8');
    expect(provider).toContain("'users', uid, 'sync', 'current'");
    expect(provider).toContain('signInWithPopup');
    expect(provider).toContain('runTransaction');
    expect(provider).toContain('let unsubscribe: () => void = () => undefined;');
    expect(config).toContain("projectId: 'inteligentny-kalendarz-s-2cfc9'");
    expect(settings).toContain('Połącz z Google');
    expect(sourceHygiene).toContain('firebase.sync-lab.json');
    expect(sourceHygiene).toContain('.github/workflows/firebase-sync-preview.yml');
  });
});
