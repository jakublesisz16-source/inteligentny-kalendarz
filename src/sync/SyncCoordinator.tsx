import { useEffect } from 'react';
import { LOCAL_DATA_CHANGED_EVENT } from '../storage/data-change-events';
import { getPreferredSyncProviderId } from './sync-config';
import {
  publishSyncRemoteApplied,
  publishSyncRuntimeNotice,
  SYNC_WAKE_EVENT,
} from './sync-events';
import { LOCAL_ONLY_SYNC_PROVIDER_ID } from './provider-ids';
import { createSyncService } from './sync-service';
import type { SyncReconcileResult } from './sync.types';

const AUTO_SYNC_INTERVAL_MS = 30_000;
const LOCAL_CHANGE_DEBOUNCE_MS = 1_500;

function publishResult(result: SyncReconcileResult): void {
  if (result.phase === 'local-only') {
    publishSyncRuntimeNotice({ state: 'local-only', providerId: result.status.providerId });
    return;
  }
  if (result.phase === 'signed-out') {
    publishSyncRuntimeNotice({ state: 'signed-out', providerId: result.status.providerId });
    return;
  }
  if (result.phase === 'conflict') {
    publishSyncRuntimeNotice({
      state: 'conflict',
      providerId: result.status.providerId,
      ...(result.status.account ? { account: result.status.account } : {}),
      conflict: result.conflict,
      message: 'Dane zmieniły się na obu urządzeniach. Wybierz wersję w Ustawieniach.',
    });
    return;
  }
  publishSyncRuntimeNotice({
    state: 'synced',
    providerId: result.status.providerId,
    ...(result.status.account ? { account: result.status.account } : {}),
    lastSyncAt: result.lastSyncAt,
    message: result.phase === 'pulled'
      ? 'Pobrano nowsze dane z chmury.'
      : result.phase === 'pushed'
        ? 'Wysłano zmiany do chmury.'
        : 'Dane są zsynchronizowane.',
  });
  if (result.phase === 'pulled') publishSyncRemoteApplied();
}

export function SyncCoordinator() {
  useEffect(() => {
    let disposed = false;
    let running = false;
    let queued = false;
    let debounceTimer: number | null = null;

    async function run() {
      if (disposed) return;
      const providerId = getPreferredSyncProviderId();
      if (providerId === LOCAL_ONLY_SYNC_PROVIDER_ID) {
        publishSyncRuntimeNotice({ state: 'local-only', providerId });
        return;
      }
      if (running) {
        queued = true;
        return;
      }
      running = true;
      publishSyncRuntimeNotice({ state: 'syncing', providerId, message: 'Synchronizuję dane...' });
      try {
        const service = await createSyncService(providerId);
        const result = await service.reconcile();
        if (!disposed) publishResult(result);
      } catch (error) {
        if (!disposed) {
          publishSyncRuntimeNotice({
            state: 'error',
            providerId,
            message: error instanceof Error ? error.message : 'Nie udało się zsynchronizować danych.',
          });
        }
      } finally {
        running = false;
        if (queued && !disposed) {
          queued = false;
          void run();
        }
      }
    }

    function scheduleFromLocalChange() {
      if (getPreferredSyncProviderId() === LOCAL_ONLY_SYNC_PROVIDER_ID) return;
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        void run();
      }, LOCAL_CHANGE_DEBOUNCE_MS);
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') void run();
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run();
    }, AUTO_SYNC_INTERVAL_MS);

    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, scheduleFromLocalChange);
    window.addEventListener(SYNC_WAKE_EVENT, run);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', handleVisibility);
    void run();

    return () => {
      disposed = true;
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      window.clearInterval(interval);
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, scheduleFromLocalChange);
      window.removeEventListener(SYNC_WAKE_EVENT, run);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}
