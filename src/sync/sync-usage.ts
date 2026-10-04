const SYNC_USAGE_STORAGE_PREFIX = 'ik.sync.usage.v1';
export const SYNC_USAGE_CHANGED_EVENT = 'ik-sync-usage-changed';

export const SYNC_USAGE_SOFT_READ_WARNING = 20_000;
export const SYNC_USAGE_SOFT_WRITE_WARNING = 8_000;
export const SYNC_USAGE_SOFT_DELETE_WARNING = 8_000;

export interface LocalSyncUsage {
  providerId: string;
  accountId: string;
  day: string;
  firestoreReads: number;
  firestoreWrites: number;
  firestoreDeletes: number;
  manifestChecks: number;
  chunkReads: number;
  chunkWrites: number;
  lastPushAt?: string;
  lastPullAt?: string;
  payloadBytes?: number;
  chunkCount?: number;
}

export interface SyncUsageDelta {
  firestoreReads?: number;
  firestoreWrites?: number;
  firestoreDeletes?: number;
  manifestChecks?: number;
  chunkReads?: number;
  chunkWrites?: number;
  lastPushAt?: string;
  lastPullAt?: string;
  payloadBytes?: number;
  chunkCount?: number;
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function usageKey(providerId: string, accountId: string): string {
  return `${SYNC_USAGE_STORAGE_PREFIX}:${providerId}:${accountId}`;
}

function emptyUsage(providerId: string, accountId: string, previous?: Partial<LocalSyncUsage>): LocalSyncUsage {
  return {
    providerId,
    accountId,
    day: localDay(),
    firestoreReads: 0,
    firestoreWrites: 0,
    firestoreDeletes: 0,
    manifestChecks: 0,
    chunkReads: 0,
    chunkWrites: 0,
    ...(previous?.lastPushAt ? { lastPushAt: previous.lastPushAt } : {}),
    ...(previous?.lastPullAt ? { lastPullAt: previous.lastPullAt } : {}),
    ...(typeof previous?.payloadBytes === 'number' ? { payloadBytes: previous.payloadBytes } : {}),
    ...(typeof previous?.chunkCount === 'number' ? { chunkCount: previous.chunkCount } : {}),
  };
}

function normalizeCounter(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function parseUsage(raw: string | null, providerId: string, accountId: string): LocalSyncUsage {
  if (!raw) return emptyUsage(providerId, accountId);
  try {
    const parsed = JSON.parse(raw) as Partial<LocalSyncUsage>;
    if (parsed.providerId !== providerId || parsed.accountId !== accountId) return emptyUsage(providerId, accountId);
    if (parsed.day !== localDay()) return emptyUsage(providerId, accountId, parsed);
    return {
      providerId,
      accountId,
      day: parsed.day,
      firestoreReads: normalizeCounter(parsed.firestoreReads),
      firestoreWrites: normalizeCounter(parsed.firestoreWrites),
      firestoreDeletes: normalizeCounter(parsed.firestoreDeletes),
      manifestChecks: normalizeCounter(parsed.manifestChecks),
      chunkReads: normalizeCounter(parsed.chunkReads),
      chunkWrites: normalizeCounter(parsed.chunkWrites),
      ...(typeof parsed.lastPushAt === 'string' ? { lastPushAt: parsed.lastPushAt } : {}),
      ...(typeof parsed.lastPullAt === 'string' ? { lastPullAt: parsed.lastPullAt } : {}),
      ...(typeof parsed.payloadBytes === 'number' && parsed.payloadBytes >= 0 ? { payloadBytes: parsed.payloadBytes } : {}),
      ...(typeof parsed.chunkCount === 'number' && parsed.chunkCount >= 0 ? { chunkCount: parsed.chunkCount } : {}),
    };
  } catch {
    return emptyUsage(providerId, accountId);
  }
}

export function readLocalSyncUsage(providerId: string, accountId: string): LocalSyncUsage {
  const target = storage();
  if (!target) return emptyUsage(providerId, accountId);
  try {
    return parseUsage(target.getItem(usageKey(providerId, accountId)), providerId, accountId);
  } catch {
    return emptyUsage(providerId, accountId);
  }
}

export function recordLocalSyncUsage(providerId: string, accountId: string, delta: SyncUsageDelta): LocalSyncUsage {
  const target = storage();
  const current = readLocalSyncUsage(providerId, accountId);
  const next: LocalSyncUsage = {
    ...current,
    firestoreReads: current.firestoreReads + normalizeCounter(delta.firestoreReads),
    firestoreWrites: current.firestoreWrites + normalizeCounter(delta.firestoreWrites),
    firestoreDeletes: current.firestoreDeletes + normalizeCounter(delta.firestoreDeletes),
    manifestChecks: current.manifestChecks + normalizeCounter(delta.manifestChecks),
    chunkReads: current.chunkReads + normalizeCounter(delta.chunkReads),
    chunkWrites: current.chunkWrites + normalizeCounter(delta.chunkWrites),
    ...(delta.lastPushAt ? { lastPushAt: delta.lastPushAt } : {}),
    ...(delta.lastPullAt ? { lastPullAt: delta.lastPullAt } : {}),
    ...(typeof delta.payloadBytes === 'number' && delta.payloadBytes >= 0 ? { payloadBytes: delta.payloadBytes } : {}),
    ...(typeof delta.chunkCount === 'number' && delta.chunkCount >= 0 ? { chunkCount: delta.chunkCount } : {}),
  };
  if (target) {
    try {
      target.setItem(usageKey(providerId, accountId), JSON.stringify(next));
    } catch {
      // Diagnostics are advisory and must never block sync or local data.
    }
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(SYNC_USAGE_CHANGED_EVENT, { detail: next }));
  }
  return next;
}

export function isSyncUsageSoftWarning(usage: LocalSyncUsage): boolean {
  return usage.firestoreReads >= SYNC_USAGE_SOFT_READ_WARNING
    || usage.firestoreWrites >= SYNC_USAGE_SOFT_WRITE_WARNING
    || usage.firestoreDeletes >= SYNC_USAGE_SOFT_DELETE_WARNING;
}
