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
import { SyncAccountOwnershipError } from './sync-errors';
import { createSyncService } from './sync-service';
import type { SyncAccount, SyncConflictChoice, SyncReconcileResult, SyncRuntimeNotice } from './sync.types';

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
  if (result.phase === 'recovery-required') {
    return {
      state: 'recovery-required',
      providerId: result.status.providerId,
      ...(result.status.account ? { account: result.status.account } : {}),
      recovery: result.recovery,
      message: 'Chmura zawiera niespójny starszy zapis. Wybierz bezpiecznie wspólną wersję danych.',
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

const RECOVERY_STORE_LABELS: Record<string, string> = {
  events: 'wydarzenia',
  studyProfile: 'profil studiów',
  universityImportEntries: 'dane planu zajęć',
  universityImports: 'historia importów planu',
};

function formatRecoveryStores(stores: readonly string[]): string {
  return stores.map((name) => RECOVERY_STORE_LABELS[name] ?? name).join(', ');
}

export function SyncSettingsPanel({ onRemoteApplied }: SyncSettingsPanelProps) {
  const [notice, setNotice] = useState<SyncRuntimeNotice>(() => getLatestSyncRuntimeNotice());
  const [busy, setBusy] = useState(false);
  const [confirmRecovery, setConfirmRecovery] = useState(false);
  const [confirmAccountSwitch, setConfirmAccountSwitch] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      const incoming = (event as CustomEvent<SyncRuntimeNotice>).detail;
      if (incoming.state !== 'recovery-required') setConfirmRecovery(false);
      if (incoming.state !== 'account-mismatch') setConfirmAccountSwitch(false);
      setNotice((current) => {
        if (incoming.account || !['error', 'syncing', 'account-mismatch'].includes(incoming.state)) return incoming;
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
    setConfirmRecovery(false);
    setConfirmAccountSwitch(false);
    setNotice({ state: 'syncing', providerId: FIREBASE_GOOGLE_SYNC_PROVIDER_ID, message: 'Łączę z kontem Google...' });
    let signedInAccount: SyncAccount | null = null;
    try {
      const service = await createSyncService(FIREBASE_GOOGLE_SYNC_PROVIDER_ID);
      signedInAccount = await service.signIn();
      if (!signedInAccount) throw new Error('Logowanie Google nie zostało zakończone.');
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
      const next: SyncRuntimeNotice = error instanceof SyncAccountOwnershipError
        ? {
            state: 'account-mismatch',
            providerId: FIREBASE_GOOGLE_SYNC_PROVIDER_ID,
            ...(signedInAccount ? { account: signedInAccount } : {}),
            message: error.message,
          }
        : {
            state: 'error',
            providerId: FIREBASE_GOOGLE_SYNC_PROVIDER_ID,
            ...(signedInAccount ? { account: signedInAccount } : {}),
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
      const next: SyncRuntimeNotice = error instanceof SyncAccountOwnershipError
        ? {
            state: 'account-mismatch',
            providerId: FIREBASE_GOOGLE_SYNC_PROVIDER_ID,
            ...(notice.account ? { account: notice.account } : {}),
            message: error.message,
          }
        : {
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

  async function replaceDamagedCloudWithLocal() {
    if (!notice.recovery) return;
    setBusy(true);
    try {
      const service = await createSyncService(FIREBASE_GOOGLE_SYNC_PROVIDER_ID);
      const result = await service.replaceDamagedCloudWithLocal(notice.recovery);
      const base = noticeFromResult(result);
      const next: SyncRuntimeNotice = result.phase === 'pushed'
        ? { ...base, message: 'Ustawiono dane z tego urządzenia jako wspólną wersję.' }
        : base;
      setConfirmRecovery(false);
      setNotice(next);
      publishSyncRuntimeNotice(next);
      requestSyncWake();
    } catch (error) {
      const next: SyncRuntimeNotice = {
        state: 'error',
        providerId: FIREBASE_GOOGLE_SYNC_PROVIDER_ID,
        ...(notice.account ? { account: notice.account } : {}),
        message: error instanceof Error ? error.message : 'Nie udało się ustawić wspólnej wersji danych.',
      };
      setNotice(next);
      publishSyncRuntimeNotice(next);
    } finally {
      setBusy(false);
    }
  }

  async function switchAccount() {
    if (!confirmAccountSwitch) {
      setConfirmAccountSwitch(true);
      return;
    }
    setBusy(true);
    try {
      const service = await createSyncService(FIREBASE_GOOGLE_SYNC_PROVIDER_ID);
      const result = await service.switchToCurrentAccount();
      setPreferredSyncProviderId(FIREBASE_GOOGLE_SYNC_PROVIDER_ID);
      const next = noticeFromResult(result);
      setConfirmAccountSwitch(false);
      setNotice(next);
      publishSyncRuntimeNotice(next);
      await onRemoteApplied();
      requestSyncWake();
    } catch (error) {
      const next: SyncRuntimeNotice = {
        state: error instanceof SyncAccountOwnershipError ? 'account-mismatch' : 'error',
        providerId: FIREBASE_GOOGLE_SYNC_PROVIDER_ID,
        ...(notice.account ? { account: notice.account } : {}),
        message: error instanceof Error ? error.message : 'Nie udało się przełączyć konta.',
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
          <button type="button" className="button button-secondary" disabled={busy || notice.state === 'conflict' || notice.state === 'recovery-required' || notice.state === 'account-mismatch'} onClick={() => void syncNow()}>{busy ? 'Synchronizuję...' : 'Synchronizuj teraz'}</button>
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
          {notice.state === 'recovery-required' ? (notice.message ?? 'Chmura wymaga jednorazowego wskazania wspólnej wersji.') : null}
          {notice.state === 'account-mismatch' ? (notice.message ?? 'Dane na tym urządzeniu należą do innego konta Google.') : null}
        </span>
      </div>

      {connected && notice.state === 'account-mismatch' ? (
        <div className="settings-sync-recovery" role="group" aria-label="Przełącz konto synchronizacji">
          <div className="settings-sync-recovery-copy">
            <strong>To urządzenie ma dane innego konta</strong>
            <span>Automatyczne połączenie zostało zablokowane, aby dane jednego konta nie trafiły do drugiego.</span>
            <span>Przełączenie usunie lokalną kopię z tego urządzenia i pobierze dane obecnie zalogowanego konta Google. Nie dzieje się to automatycznie.</span>
          </div>
          {!confirmAccountSwitch ? (
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => void switchAccount()}>Przełącz konto</button>
          ) : (
            <div className="settings-sync-recovery-confirm">
              <span>Lokalne dane poprzedniego konta na tym urządzeniu zostaną usunięte. Kontynuuj tylko wtedy, gdy chcesz przejść na konto {notice.account?.email ?? notice.account?.displayName ?? 'Google'}.</span>
              <div>
                <button type="button" className="button button-primary" disabled={busy} onClick={() => void switchAccount()}>{busy ? 'Przełączam...' : 'Potwierdź przełączenie'}</button>
                <button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirmAccountSwitch(false)}>Anuluj</button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {connected && notice.state === 'conflict' ? (
        <div className="settings-sync-conflict" role="group" aria-label="Rozwiąż konflikt synchronizacji">
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => void resolveConflict('local')}>Zachowaj to urządzenie</button>
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => void resolveConflict('cloud')}>Pobierz z chmury</button>
        </div>
      ) : null}

      {connected && notice.state === 'recovery-required' && notice.recovery ? (
        <div className="settings-sync-recovery" role="group" aria-label="Ustaw wspólną wersję danych">
          <div className="settings-sync-recovery-copy">
            <strong>Jednorazowe ustawienie wspólnej wersji</strong>
            <span>Różnią się: {formatRecoveryStores(notice.recovery.differingStores)}.</span>
            <span>Plik planu nie musi być wgrywany ponownie na drugim urządzeniu. Po naprawie synchronizowany jest wynik importu i wszystkie późniejsze zmiany.</span>
          </div>
          {!confirmRecovery ? (
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirmRecovery(true)}>Użyj danych z tego urządzenia</button>
          ) : (
            <div className="settings-sync-recovery-confirm">
              <span>Ta operacja zastąpi niespójny zapis w chmurze aktualnymi danymi z tego urządzenia. Inne urządzenia pobiorą tę wersję przy następnej synchronizacji.</span>
              <div>
                <button type="button" className="button button-primary" disabled={busy} onClick={() => void replaceDamagedCloudWithLocal()}>{busy ? 'Ustawiam...' : 'Potwierdź i ustaw jako wspólne'}</button>
                <button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirmRecovery(false)}>Anuluj</button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <p className="settings-sync-note">Aplikacja nadal działa lokalnie bez logowania i bez internetu. Chmura jest tylko dodatkiem do przenoszenia danych między Twoimi urządzeniami.</p>
    </section>
  );
}
