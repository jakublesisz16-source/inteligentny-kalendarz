import { useEffect } from 'react';
import { LOCAL_DATA_CHANGED_EVENT } from '../storage/data-change-events';
import { getPreferredSyncProviderId } from './sync-config';
import { SyncAccountOwnershipError } from './sync-errors';
import {
  publishSyncRemoteApplied,
  publishSyncRuntimeNotice,
  SYNC_WAKE_EVENT,
} from './sync-events';
import { LOCAL_ONLY_SYNC_PROVIDER_ID } from './provider-ids';
import { createSyncService, type SyncService } from './sync-service';
import { createSyncTabCoordinator } from './sync-tab-coordination';
import type { SyncReconcileResult } from './sync.types';

const AUTO_SYNC_INTERVAL_MS = 60_000;
const LOCAL_CHANGE_DEBOUNCE_MS = 2_500;
const LEADER_HEARTBEAT_MS = 4_000;

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
  if (result.phase === 'recovery-required') {
    publishSyncRuntimeNotice({
      state: 'recovery-required',
      providerId: result.status.providerId,
      ...(result.status.account ? { account: result.status.account } : {}),
      recovery: result.recovery,
      message: 'Chmura wymaga jednorazowego wskazania wspólnej wersji danych w Ustawieniach.',
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
    let service: SyncService | null = null;

    const coordinator = createSyncTabCoordinator((type) => {
      if (disposed) return;
      if (type === 'remote-applied') {
        publishSyncRemoteApplied();
        return;
      }
      if (!coordinator.refreshLeadership()) return;
      if (type === 'local-change') scheduleFromLocalChange(false);
      else if (type === 'wake') void run();
    });

    async function publishAccountMismatch(providerId: string, error: SyncAccountOwnershipError) {
      let account = undefined;
      try {
        account = (await service?.getStatus())?.account ?? undefined;
      } catch {
        // The ownership guard remains valid even if account metadata cannot refresh.
      }
      publishSyncRuntimeNotice({
        state: 'account-mismatch',
        providerId,
        ...(account ? { account } : {}),
        message: error.message,
      });
    }

    async function run() {
      if (disposed || document.visibilityState !== 'visible') return;
      if (!coordinator.refreshLeadership()) return;
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
        service = await createSyncService(providerId);
        const result = await service.reconcile();
        if (!disposed) {
          publishResult(result);
          if (result.phase === 'pulled') coordinator.announce('remote-applied');
        }
      } catch (error) {
        if (!disposed) {
          if (error instanceof SyncAccountOwnershipError) await publishAccountMismatch(providerId, error);
          else {
            publishSyncRuntimeNotice({
              state: 'error',
              providerId,
              message: error instanceof Error ? error.message : 'Nie udało się zsynchronizować danych.',
            });
          }
        }
      } finally {
        running = false;
        if (queued && !disposed) {
          queued = false;
          void run();
        }
      }
    }

    function scheduleFromLocalChange(announceIfFollower = true) {
      if (getPreferredSyncProviderId() === LOCAL_ONLY_SYNC_PROVIDER_ID) return;
      if (!coordinator.refreshLeadership()) {
        if (announceIfFollower) coordinator.announce('local-change');
        return;
      }
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        void run();
      }, LOCAL_CHANGE_DEBOUNCE_MS);
    }

    function handleLocalDataChanged() {
      scheduleFromLocalChange(true);
    }

    function handleWake() {
      if (coordinator.refreshLeadership()) void run();
      else coordinator.announce('wake');
    }

    function handleVisibility() {
      if (document.visibilityState !== 'visible') {
        coordinator.refreshLeadership();
        return;
      }
      if (coordinator.refreshLeadership()) void run();
    }

    function handleFocus() {
      if (coordinator.refreshLeadership()) void run();
    }

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && coordinator.refreshLeadership()) void run();
    }, AUTO_SYNC_INTERVAL_MS);
    const leaderHeartbeat = window.setInterval(() => {
      coordinator.refreshLeadership();
    }, LEADER_HEARTBEAT_MS);

    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, handleLocalDataChanged);
    window.addEventListener(SYNC_WAKE_EVENT, handleWake);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    if (coordinator.refreshLeadership()) void run();

    return () => {
      disposed = true;
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      window.clearInterval(pollInterval);
      window.clearInterval(leaderHeartbeat);
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, handleLocalDataChanged);
      window.removeEventListener(SYNC_WAKE_EVENT, handleWake);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      coordinator.dispose();
    };
  }, []);

  return null;
}
