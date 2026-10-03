import type { SyncProvider } from './sync.types';
import { FIREBASE_GOOGLE_SYNC_PROVIDER_ID, LOCAL_ONLY_SYNC_PROVIDER_ID } from './provider-ids';
import { createLocalOnlySyncProvider } from './providers/local-only';

export type SyncProviderFactory = () => SyncProvider | Promise<SyncProvider>;

const factories = new Map<string, SyncProviderFactory>([
  [LOCAL_ONLY_SYNC_PROVIDER_ID, createLocalOnlySyncProvider],
  [FIREBASE_GOOGLE_SYNC_PROVIDER_ID, async () => {
    const module = await import('./providers/firebase-google');
    return module.createFirebaseGoogleSyncProvider();
  }],
]);

export function registerSyncProvider(id: string, factory: SyncProviderFactory): () => void {
  if (!id.trim()) throw new Error('Sync provider id is required.');
  factories.set(id, factory);
  return () => {
    if (factories.get(id) === factory) factories.delete(id);
  };
}

export function hasSyncProvider(id: string): boolean {
  return factories.has(id);
}

export async function resolveSyncProvider(id: string): Promise<SyncProvider> {
  const factory = factories.get(id) ?? factories.get(LOCAL_ONLY_SYNC_PROVIDER_ID);
  if (!factory) throw new Error('Local-only sync provider is unavailable.');
  return factory();
}
