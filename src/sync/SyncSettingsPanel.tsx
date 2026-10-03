import { useEffect, useState } from 'react';
import {
  FIREBASE_GOOGLE_SYNC_PROVIDER_ID,
  LOCAL_ONLY_SYNC_PROVIDER_ID,
} from './provider-ids';
import {
  getLatestSyncRuntimeNotice,
  publishSyncRuntimeNotice,
  requestSyncWake,
  SYNC_RUNTIME_NOTICE_EVENT,
} from './sync-events';
import {
  getPreferredSyncProviderId,
  readLocalSyncState,
  resetSyncProviderPreference,
  setPreferredSyncProviderId,
} from './sync-config';
import { createSyncService } from './sync-service';
import type { SyncConflictChoice, SyncReconcileResult, SyncRuntimeNotice } from './sync.types';

interface SyncSettingsPanelProps {
  onRemoteApplied: () => Promise<void>;
}

function noticeFromResult(result: SyncReconcileResult): SyncRuntimeNotice {
  if (result.phase === 'local-only') return { state: 'local-only', providerId: result.status.providerId };
  if (result.phase === 'signed-out') return { state: 'signed-out', providerId: result.status.providerId };
  if (result.phase === 'conflict') {
    return {
      state: 'conflict',
      providerId: result.status.providerId,
      ...(result.status.account ? { account: result.status.account } : {}),
      conflict: result.conflict,
      message: 'Na tym urządzeniu i w chmurze są różne zmiany.',
    };
  }
  return {
    state: 'synced',
    providerId: result.status.providerId,
    ...(result.status.account ? { account: result.status.account } : {}),
    lastSyncAt: result.lastSyncAt,
    message: result.phase === 'pulled'
      ? 'Pobrano dane z chmury.'
      : result.phase === 'pushed'
        ? 'Wysłano dane do chmury.'
        : 'Dane są zsynchronizowane.',
  };
}

function formatSyncTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(date);
}

export function SyncSettingsPanel({ onRemoteApplied }: SyncSettingsPanelProps) {
  const [notice, setNotice] = useState<SyncRuntimeNotice>(() => getLatestSyncRuntimeNotice());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      const incoming = (event as CustomEvent<SyncRuntimeNotice>).detail;
      setNotice((current) => {
        if (incoming.account || (incoming.state !== 'error' && incoming.state !== 'syncing')) return incoming;
        return { ...incoming, ...(current.account ? { account: current.account } : {}) };
      });
    };
    window.addEventListener(SYNC_RUNTIME_NOTICE_EVENT, handler);

    // Warm the optional Firebase runtime only when the user opens Settings.
    // This keeps local-only startup free from cloud SDK work and preserves user activation for the popup.
    void createSyncService(FIREBASE_GOOGLE_SYNC_PROVIDER_ID)
      .then(async (service) => {
        const status = await service.getStatus();
        if (getPreferredSyncProviderId() !== FIREBASE_GOOGLE_SYNC_PROVIDER_ID) return;
        if (!status.account) setNotice({ state: 'signed-out', providerId: status.providerId });
        else {
          const local = readLocalSyncState(status.providerId, status.account.id);
          setNotice({
            state: local ? 'synced' : 'syncing',
            providerId: status.providerId,
            account: status.account,
            ...(local ? { lastSyncAt: local.lastSyncedAt, message: 'Synchronizacja jest włączona.' } : { message: 'Sprawdzam dane...' }),
          });
          requestSyncWake();
        }
      })
      .catch(() => undefined);

    return () => window.removeEventListener(SYNC_RUNTIME_NOTICE_EVENT, handler);
  }, []);

  async function connectGoogle() {
    setBusy(true);
    setNotice({ state: 'syncing', providerId: FIREBASE_GOOGLE_SYNC_PROVIDER_ID, message: 'Łączę z kontem Google...' });
    try {
      const service = await createSyncService(FIREBASE_GOOGLE_SYNC_PROVIDER_ID);
      const account = await service.signIn();
      if (!account) throw new Error('Logowanie Google nie zostało zakończone.');
      const result = await service.reconcile();
      setPreferredSyncProviderId(FIREBASE_GOOGLE_SYNC_PROVIDER_ID);
      const next = noticeFromResult(result);
      setNotice(next);
      publishSyncRuntimeNotice(next);
      if (result.phase === 'pulled') {
        await onRemoteApplied();
      }
      requestSyncWake();
    } catch (error) {
      const next: SyncRuntimeNotice = {
        state: 'error',
        providerId: FIREBASE_GOOGLE_SYNC_PROVIDER_ID,
        message: error instanceof Error ? error.message : 'Nie udało się połączyć z Google.',
      };
      setNotice(next);
      publishSyncRuntimeNotice(next);
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    try {
      const service = await createSyncService(FIREBASE_GOOGLE_SYNC_PROVIDER_ID);
      const result = await service.reconcile();
      const next = noticeFromResult(result);
      setNotice(next);
      publishSyncRuntimeNotice(next);
      if (result.phase === 'pulled') await onRemoteApplied();
    } catch (error) {
      const next: SyncRuntimeNotice = {
        state: 'error',
        providerId: FIREBASE_GOOGLE_SYNC_PROVIDER_ID,
        ...(notice.account ? { account: notice.account } : {}),
        message: error instanceof Error ? error.message : 'Nie udało się zsynchronizować danych.',
      };
      setNotice(next);
      publishSyncRuntimeNotice(next);
    } finally {
      setBusy(false);
    }
  }

  async function resolveConflict(choice: SyncConflictChoice) {
    setBusy(true);
    try {
      const service = await createSyncService(FIREBASE_GOOGLE_SYNC_PROVIDER_ID);
      const result = await service.resolveConflict(choice);
      const next = noticeFromResult(result);
      setNotice(next);
      publishSyncRuntimeNotice(next);
      if (result.phase === 'pulled') await onRemoteApplied();
      requestSyncWake();
    } catch (error) {
      const next: SyncRuntimeNotice = {
        state: 'error',
        providerId: FIREBASE_GOOGLE_SYNC_PROVIDER_ID,
        ...(notice.account ? { account: notice.account } : {}),
        message: error instanceof Error ? error.message : 'Nie udało się rozwiązać konfliktu synchronizacji.',
      };
      setNotice(next);
      publishSyncRuntimeNotice(next);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const service = await createSyncService(FIREBASE_GOOGLE_SYNC_PROVIDER_ID);
      await service.signOut();
    } catch {
      // Local-only fallback must remain available even if remote sign-out fails.
    } finally {
      resetSyncProviderPreference();
      const next: SyncRuntimeNotice = { state: 'local-only', providerId: LOCAL_ONLY_SYNC_PROVIDER_ID };
      setNotice(next);
      publishSyncRuntimeNotice(next);
      requestSyncWake();
      setBusy(false);
    }
  }

  const connected = notice.providerId === FIREBASE_GOOGLE_SYNC_PROVIDER_ID && Boolean(notice.account);

  return (
    <section className="settings-sync-panel" aria-label="Synchronizacja między urządzeniami">
      <div className="settings-sync-copy">
        <strong>Synchronizacja</strong>
        <small>{connected ? (notice.account?.email ?? notice.account?.displayName ?? 'Konto Google') : 'Opcjonalnie między telefonem i komputerem'}</small>
      </div>

      {!connected ? (
        <button type="button" className="button button-secondary settings-sync-google" disabled={busy} onClick={() => void connectGoogle()}>
          <span aria-hidden="true">G</span>{busy ? 'Łączenie...' : 'Połącz z Google'}
        </button>
      ) : (
        <div className="settings-sync-actions">
          <button type="button" className="button button-secondary" disabled={busy || notice.state === 'conflict'} onClick={() => void syncNow()}>{busy ? 'Synchronizuję...' : 'Synchronizuj teraz'}</button>
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => void disconnect()}>Wyloguj</button>
        </div>
      )}

      <div className={`settings-sync-status is-${notice.state}`} role="status" aria-live="polite">
        <span className="settings-sync-dot" aria-hidden="true" />
        <span>
          {notice.state === 'local-only' ? 'Dane są tylko na tym urządzeniu.' : null}
          {notice.state === 'signed-out' ? 'Połącz konto Google, aby włączyć synchronizację.' : null}
          {notice.state === 'syncing' ? (notice.message ?? 'Synchronizuję...') : null}
          {notice.state === 'synced' ? `${notice.message ?? 'Dane są zsynchronizowane.'}${notice.lastSyncAt ? ` Ostatnio: ${formatSyncTime(notice.lastSyncAt)}.` : ''}` : null}
          {notice.state === 'error' ? (notice.message ?? 'Synchronizacja jest chwilowo niedostępna.') : null}
          {notice.state === 'conflict' ? 'Zmiany są na obu urządzeniach. Wybierz, które dane zachować.' : null}
        </span>
      </div>

      {connected && notice.state === 'conflict' ? (
        <div className="settings-sync-conflict" role="group" aria-label="Rozwiąż konflikt synchronizacji">
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => void resolveConflict('local')}>Zachowaj to urządzenie</button>
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => void resolveConflict('cloud')}>Pobierz z chmury</button>
        </div>
      ) : null}

      <p className="settings-sync-note">Aplikacja nadal działa lokalnie bez logowania i bez internetu. Chmura jest tylko dodatkiem do przenoszenia danych między Twoimi urządzeniami.</p>
    </section>
  );
}
