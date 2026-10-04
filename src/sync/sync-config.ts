import { LOCAL_ONLY_SYNC_PROVIDER_ID } from './provider-ids';

const PROVIDER_STORAGE_KEY = 'ik.sync.provider.v1';
const DEVICE_STORAGE_KEY = 'ik.sync.device.v1';
const STATE_STORAGE_PREFIX = 'ik.sync.state.v1';

export interface LocalSyncState {
  providerId: string;
  accountId: string;
  lastSyncedRevision: string;
  lastSyncedAt: string;
  lastRemotePayloadSha256?: string;
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getPreferredSyncProviderId(): string {
  return storage()?.getItem(PROVIDER_STORAGE_KEY)?.trim() || LOCAL_ONLY_SYNC_PROVIDER_ID;
}

export function setPreferredSyncProviderId(providerId: string): void {
  const target = storage();
  if (!target) return;
  if (!providerId || providerId === LOCAL_ONLY_SYNC_PROVIDER_ID) target.removeItem(PROVIDER_STORAGE_KEY);
  else target.setItem(PROVIDER_STORAGE_KEY, providerId);
}

export function resetSyncProviderPreference(): void {
  setPreferredSyncProviderId(LOCAL_ONLY_SYNC_PROVIDER_ID);
}

export function getSyncDeviceId(): string {
  const target = storage();
  if (!target) return 'server-local-device';
  const existing = target.getItem(DEVICE_STORAGE_KEY)?.trim();
  if (existing) return existing;
  const value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  target.setItem(DEVICE_STORAGE_KEY, value);
  return value;
}

function syncStateKey(providerId: string, accountId: string): string {
  return `${STATE_STORAGE_PREFIX}:${providerId}:${accountId}`;
}

export function readLocalSyncState(providerId: string, accountId: string): LocalSyncState | null {
  const target = storage();
  if (!target) return null;
  try {
    const raw = target.getItem(syncStateKey(providerId, accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalSyncState>;
    if (
      parsed.providerId !== providerId
      || parsed.accountId !== accountId
      || typeof parsed.lastSyncedRevision !== 'string'
      || typeof parsed.lastSyncedAt !== 'string'
      || (parsed.lastRemotePayloadSha256 !== undefined && typeof parsed.lastRemotePayloadSha256 !== 'string')
    ) return null;
    return parsed as LocalSyncState;
  } catch {
    return null;
  }
}

export function writeLocalSyncState(state: LocalSyncState): void {
  const target = storage();
  if (!target) return;
  try {
    target.setItem(syncStateKey(state.providerId, state.accountId), JSON.stringify(state));
  } catch {
    // Local sync metadata is advisory. Application data remains in IndexedDB.
  }
}

export function clearLocalSyncState(providerId: string, accountId: string): void {
  const target = storage();
  if (!target) return;
  try {
    target.removeItem(syncStateKey(providerId, accountId));
  } catch {
    // Advisory metadata only.
  }
}
