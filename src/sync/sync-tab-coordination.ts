const SYNC_TAB_CHANNEL_NAME = 'ik-sync-tabs-v1';
const SYNC_LEADER_STORAGE_KEY = 'ik.sync.leader.v1';
const SYNC_MESSAGE_STORAGE_KEY = 'ik.sync.message.v1';
const SYNC_ACCOUNT_SWITCH_GENERATION_KEY = 'ik.sync.account-switch.v1';
const ACCOUNT_SWITCH_PROBE_MS = 350;
const SYNC_WRITE_LOCK_STORAGE_KEY = 'ik.sync.write-lock.v1';
const LEADER_LEASE_MS = 10_000;
const WRITE_LOCK_LEASE_MS = 30_000;
const WRITE_LOCK_RENEW_MS = 10_000;
const WRITE_LOCK_WAIT_MS = 120;
const WRITE_LOCK_MAX_WAIT_MS = 12_000;

export type SyncTabMessageType =
  | 'local-change' | 'wake' | 'remote-applied'
  | 'account-switch-probe' | 'account-switch-present' | 'account-switch-committed';

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

const CURRENT_TAB_ID = randomId('tab');

function localStorageSafe(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : (typeof localStorage === 'undefined' ? null : localStorage);
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

// The generation is advisory: it alerts sleeping tabs when the account's entire
// dataset has changed. It is never used as an authorization or a data source.
function readAccountSwitchGeneration(): string | null {
  try { return localStorageSafe()?.getItem(SYNC_ACCOUNT_SWITCH_GENERATION_KEY) ?? null; }
  catch { return null; }
}
let knownAccountSwitchGeneration = readAccountSwitchGeneration();

function refreshAfterAccountSwitch(): void {
  const actual = readAccountSwitchGeneration();
  if (!actual || actual === knownAccountSwitchGeneration) return;
  knownAccountSwitchGeneration = actual;
  if (typeof window !== 'undefined') window.location?.reload();
}

function buildMessage(type: SyncTabMessageType): SyncTabMessage {
  return { type, sourceTabId: CURRENT_TAB_ID, sentAt: Date.now(), nonce: randomId('message') };
}

function publishMessage(message: SyncTabMessage, channel: BroadcastChannel | null): void {
  if (channel) channel.postMessage(message);
  else localStorageSafe()?.setItem(SYNC_MESSAGE_STORAGE_KEY, JSON.stringify(message));
}

// Before explicitly replacing account A with B, ask every responsive open tab
// to identify itself. Refuse the switch if another tab replies. A sleeping tab
// may not respond; the committed generation triggers a reload upon its resume.
export async function assertNoOtherOpenSyncTabs(waitMs = ACCOUNT_SWITCH_PROBE_MS): Promise<void> {
  const storage = localStorageSafe();
  // Fail closed: without localStorage we cannot alert resumed/background tabs.
  if (!storage || typeof window === 'undefined') {
    if (typeof window === 'undefined') return; // server/test environment without browser tabs
    throw new Error('Nie można sprawdzić otwartych kart. Włącz pamięć przeglądarki przed przełączeniem konta.');
  }
  // A successful read alone does not prove that a resumed tab can detect a
  // later commit. Require writeable origin storage before replacing any data.
  try {
    const probeKey = 'ik.sync.account-switch.storage-check.v1';
    storage.setItem(probeKey, CURRENT_TAB_ID);
    storage.removeItem(probeKey);
  } catch {
    throw new Error('Nie można zapisać sygnału bezpieczeństwa w przeglądarce. Dane nie zostały zmienione.');
  }
  const initialGeneration = readAccountSwitchGeneration();
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(SYNC_TAB_CHANNEL_NAME) : null;
  let otherPresent = false;
  let concurrentCommit = false;
  const observe = (message: SyncTabMessage) => {
    if (!message || message.sourceTabId === CURRENT_TAB_ID) return;
    if (message.type === 'account-switch-present') otherPresent = true;
    // Another tab may finish its own A→B switch while we are still probing.
    // A committed switch must veto this operation, even without a presence reply.
    if (message.type === 'account-switch-committed') concurrentCommit = true;
  };
  const storageHandler = (event: StorageEvent) => {
    if (event.key === SYNC_ACCOUNT_SWITCH_GENERATION_KEY) {
      refreshAfterAccountSwitch();
      return;
    }
    if (event.key !== SYNC_MESSAGE_STORAGE_KEY || !event.newValue) return;
    try { observe(JSON.parse(event.newValue) as SyncTabMessage); } catch { /* ignore */ }
  };
  if (channel) channel.onmessage = (event: MessageEvent<SyncTabMessage>) => observe(event.data);
  else window.addEventListener('storage', storageHandler);
  try {
    publishMessage(buildMessage('account-switch-probe'), channel);
    await sleep(waitMs);
  } finally {
    channel?.close();
    if (!channel) window.removeEventListener('storage', storageHandler);
  }
  if (otherPresent) {
    throw new Error('Przed przełączeniem konta zamknij pozostałe karty Inteligentnego Kalendarza i spróbuj ponownie. Dane nie zostały zmienione.');
  }
  // A persistent generation check catches commits whose BroadcastChannel event
  // was missed (including when the fallback storage listener was not installed).
  if (concurrentCommit || readAccountSwitchGeneration() !== initialGeneration) {
    throw new Error('Wykryto zmianę konta w innej karcie podczas sprawdzania. Odśwież aplikację przed kolejną próbą. Przełączenie w tej karcie zostało wstrzymane.');
  }
}

export function announceAccountSwitchCommitted(): void {
  const generation = randomId('account-switch');
  const storage = localStorageSafe();
  knownAccountSwitchGeneration = generation;
  try { storage?.setItem(SYNC_ACCOUNT_SWITCH_GENERATION_KEY, generation); } catch { /* best effort */ }
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(SYNC_TAB_CHANNEL_NAME) : null;
  try { publishMessage(buildMessage('account-switch-committed'), channel); }
  finally { channel?.close(); }
}

export interface SyncTabCoordinatorHandle {
  readonly tabId: string;
  refreshLeadership(): boolean;
  isLeader(): boolean;
  announce(type: SyncTabMessageType): void;
  dispose(): void;
}

export function createSyncTabCoordinator(onMessage: (type: SyncTabMessageType) => void): SyncTabCoordinatorHandle {
  const tabId = CURRENT_TAB_ID;
  let leader = false;
  let disposed = false;
  let channel: BroadcastChannel | null = null;

  const handleMessage = (message: SyncTabMessage) => {
    if (disposed || message.sourceTabId === tabId) return;
    if (message.type === 'account-switch-probe') {
      announce('account-switch-present');
      return;
    }
    if (message.type === 'account-switch-committed') {
      // The data set was replaced in another tab. The old React state and
      // pending operations must not continue against the newly owned database.
      knownAccountSwitchGeneration = null;
      refreshAfterAccountSwitch();
      return;
    }
    if (message.type === 'account-switch-present') return;
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
    if (event.key === SYNC_ACCOUNT_SWITCH_GENERATION_KEY) {
      refreshAfterAccountSwitch();
      return;
    }
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
    try { publishMessage(buildMessage(type), channel); }
    catch { /* Best-effort notification only. */ }
  }

  return {
    tabId,
    refreshLeadership() {
      refreshAfterAccountSwitch();
      return refreshLeadership();
    },
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
