import type { SyncProvider, SyncSnapshotEnvelope } from '../sync.types';

export const LOCAL_ONLY_SYNC_PROVIDER_ID = 'local-only';

export function createLocalOnlySyncProvider(): SyncProvider {
  return {
    id: LOCAL_ONLY_SYNC_PROVIDER_ID,
    mode: 'local-only',
    capabilities: { cloud: false, authentication: false },
    isConfigured: () => true,
    getAccount: async () => null,
    signIn: async () => null,
    signOut: async () => undefined,
    pullLatest: async () => null,
    pushSnapshot: async (_snapshot: SyncSnapshotEnvelope) => undefined,
  };
}
