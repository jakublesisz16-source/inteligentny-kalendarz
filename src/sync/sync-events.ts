import type { SyncRuntimeNotice } from './sync.types';

export const SYNC_RUNTIME_NOTICE_EVENT = 'ik:sync-runtime-notice';
export const SYNC_WAKE_EVENT = 'ik:sync-wake';
export const SYNC_REMOTE_APPLIED_EVENT = 'ik:sync-remote-applied';

let latestNotice: SyncRuntimeNotice = {
  state: 'local-only',
  providerId: 'local-only',
};

export function getLatestSyncRuntimeNotice(): SyncRuntimeNotice {
  return latestNotice;
}

export function publishSyncRuntimeNotice(notice: SyncRuntimeNotice): void {
  latestNotice = notice;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SyncRuntimeNotice>(SYNC_RUNTIME_NOTICE_EVENT, { detail: notice }));
}

export function requestSyncWake(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SYNC_WAKE_EVENT));
}

export function publishSyncRemoteApplied(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SYNC_REMOTE_APPLIED_EVENT));
}
