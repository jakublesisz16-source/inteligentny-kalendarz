export type LocalStorageProtectionStatus = 'checking' | 'persistent' | 'standard' | 'unsupported';

function storageManager(): StorageManager | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator.storage;
}

export async function getLocalStorageProtectionStatus(): Promise<LocalStorageProtectionStatus> {
  const manager = storageManager();
  if (!manager || typeof manager.persisted !== 'function') return 'unsupported';
  try {
    return await manager.persisted() ? 'persistent' : 'standard';
  } catch {
    return 'standard';
  }
}

export async function requestLocalStoragePersistence(): Promise<boolean> {
  const manager = storageManager();
  if (!manager || typeof manager.persist !== 'function') return false;
  try {
    return await manager.persist();
  } catch {
    return false;
  }
}
