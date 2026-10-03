import { LOCAL_ONLY_SYNC_PROVIDER_ID } from '../provider-ids';
import type { SyncProvider, SyncSnapshotEnvelope } from '../sync.types';

export { LOCAL_ONLY_SYNC_PROVIDER_ID } from '../provider-ids';

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
    pushSnapshot: async (_snapshot: SyncSnapshotEnvelope, _expectedRevision?: string | null) => undefined,
  };
}
