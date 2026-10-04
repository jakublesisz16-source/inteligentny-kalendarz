const SYNC_TAB_CHANNEL_NAME = 'ik-sync-tabs-v1';
const SYNC_LEADER_STORAGE_KEY = 'ik.sync.leader.v1';
const SYNC_MESSAGE_STORAGE_KEY = 'ik.sync.message.v1';
const SYNC_WRITE_LOCK_STORAGE_KEY = 'ik.sync.write-lock.v1';
const LEADER_LEASE_MS = 10_000;
const WRITE_LOCK_LEASE_MS = 30_000;
const WRITE_LOCK_RENEW_MS = 10_000;
const WRITE_LOCK_WAIT_MS = 120;
const WRITE_LOCK_MAX_WAIT_MS = 12_000;

export type SyncTabMessageType = 'local-change' | 'wake' | 'remote-applied';

interface SyncTabMessage {
  type: SyncTabMessageType;
  sourceTabId: string;
  sentAt: number;
  nonce: string;
}

interface LeaseRecord {
  ownerId: string;
  expiresAt: number;
}

function randomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localStorageSafe(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function parseLease(raw: string | null): LeaseRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LeaseRecord>;
    if (typeof parsed.ownerId !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    return { ownerId: parsed.ownerId, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function readLease(key: string): LeaseRecord | null {
  return parseLease(localStorageSafe()?.getItem(key) ?? null);
}

function writeLease(key: string, lease: LeaseRecord): boolean {
  const storage = localStorageSafe();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(lease));
    return true;
  } catch {
    return false;
  }
}

function removeLeaseIfOwned(key: string, ownerId: string): void {
  const storage = localStorageSafe();
  if (!storage) return;
  try {
    const current = readLease(key);
    if (current?.ownerId === ownerId) storage.removeItem(key);
  } catch {
    // Best-effort coordination metadata only.
  }
}

export interface SyncTabCoordinatorHandle {
  readonly tabId: string;
  refreshLeadership(): boolean;
  isLeader(): boolean;
  announce(type: SyncTabMessageType): void;
  dispose(): void;
}

export function createSyncTabCoordinator(onMessage: (type: SyncTabMessageType) => void): SyncTabCoordinatorHandle {
  const tabId = randomId('tab');
  let leader = false;
  let disposed = false;
  let channel: BroadcastChannel | null = null;

  const handleMessage = (message: SyncTabMessage) => {
    if (disposed || message.sourceTabId === tabId) return;
    onMessage(message.type);
  };

  if (typeof BroadcastChannel === 'function') {
    channel = new BroadcastChannel(SYNC_TAB_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<SyncTabMessage>) => {
      const message = event.data;
      if (!message || typeof message.type !== 'string' || typeof message.sourceTabId !== 'string') return;
      handleMessage(message);
    };
  }

  const storageHandler = (event: StorageEvent) => {
    if (event.key !== SYNC_MESSAGE_STORAGE_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue) as SyncTabMessage;
      if (!message || typeof message.type !== 'string' || typeof message.sourceTabId !== 'string') return;
      handleMessage(message);
    } catch {
      // Ignore malformed best-effort coordination messages.
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', storageHandler);

  function refreshLeadership(): boolean {
    if (disposed || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) {
      if (leader) removeLeaseIfOwned(SYNC_LEADER_STORAGE_KEY, tabId);
      leader = false;
      return false;
    }
    const storage = localStorageSafe();
    if (!storage) {
      leader = true;
      return true;
    }
    const now = Date.now();
    const current = readLease(SYNC_LEADER_STORAGE_KEY);
    if (current && current.ownerId !== tabId && current.expiresAt > now) {
      leader = false;
      return false;
    }
    writeLease(SYNC_LEADER_STORAGE_KEY, { ownerId: tabId, expiresAt: now + LEADER_LEASE_MS });
    const confirmed = readLease(SYNC_LEADER_STORAGE_KEY);
    leader = confirmed?.ownerId === tabId;
    return leader;
  }

  function announce(type: SyncTabMessageType): void {
    if (disposed) return;
    const message: SyncTabMessage = {
      type,
      sourceTabId: tabId,
      sentAt: Date.now(),
      nonce: randomId('message'),
    };
    channel?.postMessage(message);
    if (!channel) {
      const storage = localStorageSafe();
      try {
        storage?.setItem(SYNC_MESSAGE_STORAGE_KEY, JSON.stringify(message));
      } catch {
        // Best-effort only.
      }
    }
  }

  return {
    tabId,
    refreshLeadership,
    isLeader: () => leader,
    announce,
    dispose() {
      if (disposed) return;
      disposed = true;
      removeLeaseIfOwned(SYNC_LEADER_STORAGE_KEY, tabId);
      channel?.close();
      channel = null;
      if (typeof window !== 'undefined') window.removeEventListener('storage', storageHandler);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withStorageWriteLease<T>(work: () => Promise<T>): Promise<T> {
  const storage = localStorageSafe();
  if (!storage) return work();
  const ownerId = randomId('writer');
  const startedAt = Date.now();

  while (true) {
    const now = Date.now();
    const current = readLease(SYNC_WRITE_LOCK_STORAGE_KEY);
    if (!current || current.expiresAt <= now || current.ownerId === ownerId) {
      writeLease(SYNC_WRITE_LOCK_STORAGE_KEY, { ownerId, expiresAt: now + WRITE_LOCK_LEASE_MS });
      const confirmed = readLease(SYNC_WRITE_LOCK_STORAGE_KEY);
      if (confirmed?.ownerId === ownerId) break;
    }
    if (Date.now() - startedAt >= WRITE_LOCK_MAX_WAIT_MS) {
      throw new Error('Inna karta nadal zapisuje synchronizację. Spróbuj ponownie po zakończeniu bieżącego zapisu.');
    }
    await sleep(WRITE_LOCK_WAIT_MS);
  }

  const renewTimer = setInterval(() => {
    const current = readLease(SYNC_WRITE_LOCK_STORAGE_KEY);
    if (current?.ownerId === ownerId) {
      writeLease(SYNC_WRITE_LOCK_STORAGE_KEY, { ownerId, expiresAt: Date.now() + WRITE_LOCK_LEASE_MS });
    }
  }, WRITE_LOCK_RENEW_MS);

  try {
    return await work();
  } finally {
    clearInterval(renewTimer);
    removeLeaseIfOwned(SYNC_WRITE_LOCK_STORAGE_KEY, ownerId);
  }
}

export async function withCrossTabSyncWriteLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { locks?: { request<R>(name: string, callback: () => Promise<R>): Promise<R> } }).locks
    : undefined;
  if (locks?.request) return locks.request('ik-sync-cloud-write-v1', work);
  return withStorageWriteLease(work);
}
