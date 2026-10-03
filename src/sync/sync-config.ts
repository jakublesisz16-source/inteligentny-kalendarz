import { LOCAL_ONLY_SYNC_PROVIDER_ID } from './providers/local-only';

const STORAGE_KEY = 'ik.sync.provider.v1';

export function getPreferredSyncProviderId(): string {
  if (typeof window === 'undefined') return LOCAL_ONLY_SYNC_PROVIDER_ID;
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() || LOCAL_ONLY_SYNC_PROVIDER_ID;
  } catch {
    return LOCAL_ONLY_SYNC_PROVIDER_ID;
  }
}

export function setPreferredSyncProviderId(providerId: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!providerId || providerId === LOCAL_ONLY_SYNC_PROVIDER_ID) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, providerId);
  } catch {
    // Provider preference is optional. Local operation must never depend on storage availability.
  }
}

export function resetSyncProviderPreference(): void {
  setPreferredSyncProviderId(LOCAL_ONLY_SYNC_PROVIDER_ID);
}
