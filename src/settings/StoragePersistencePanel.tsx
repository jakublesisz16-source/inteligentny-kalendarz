import { useEffect, useState } from 'react';
import { getLocalStorageProtectionStatus, requestLocalStoragePersistence, type LocalStorageProtectionStatus } from '../storage/persistence';

function statusLabel(status: LocalStorageProtectionStatus): string {
  if (status === 'persistent') return 'Chronione przez przeglądarkę';
  if (status === 'standard') return 'Standardowe przechowywanie';
  if (status === 'unsupported') return 'Standardowe przechowywanie';
  return 'Sprawdzanie...';
}

export function StoragePersistencePanel() {
  const [status, setStatus] = useState<LocalStorageProtectionStatus>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void getLocalStorageProtectionStatus().then((next) => { if (active) setStatus(next); });
    return () => { active = false; };
  }, []);

  async function strengthenProtection() {
    setBusy(true);
    setMessage('');
    const granted = await requestLocalStoragePersistence();
    const next = await getLocalStorageProtectionStatus();
    setStatus(next);
    setMessage(granted || next === 'persistent'
      ? 'Przeglądarka przyznała trwałe przechowywanie.'
      : 'Przeglądarka nie przyznała trwałego przechowywania. Eksport danych nadal działa.');
    setBusy(false);
  }

  return (
    <section className="storage-persistence-panel" aria-labelledby="storage-persistence-title">
      <div>
        <p className="section-kicker">Trwałość danych</p>
        <h3 id="storage-persistence-title">Dane lokalne w tej przeglądarce</h3>
        <p>Dane są zapisane lokalnie. Dla dodatkowego bezpieczeństwa możesz regularnie eksportować plik danych.</p>
      </div>
      <div className="storage-persistence-status">
        <span>Status</span>
        <strong>{statusLabel(status)}</strong>
      </div>
      {status === 'standard' ? <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => void strengthenProtection()}>{busy ? 'Sprawdzam...' : 'Wzmocnij ochronę'}</button> : null}
      {status === 'unsupported' ? <p className="muted-copy">Ta przeglądarka nie udostępnia dodatkowej ochrony pamięci. Aplikacja nadal działa normalnie.</p> : null}
      {message ? <p className="storage-persistence-message" role="status" aria-live="polite">{message}</p> : null}
    </section>
  );
}
