export { createSyncService, SyncService } from './sync-service';
export { getPreferredSyncProviderId, resetSyncProviderPreference, setPreferredSyncProviderId } from './sync-config';
export { hasSyncProvider, registerSyncProvider, resolveSyncProvider } from './provider-registry';
export { LOCAL_ONLY_SYNC_PROVIDER_ID } from './providers/local-only';
export type { SyncAccount, SyncProvider, SyncProviderCapabilities, SyncSnapshotEnvelope, SyncStatus } from './sync.types';
