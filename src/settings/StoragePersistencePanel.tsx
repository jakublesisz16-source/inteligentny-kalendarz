import { useEffect, useState } from 'react';
import { getLocalStorageProtectionStatus, requestLocalStoragePersistence, type LocalStorageProtectionStatus } from '../storage/persistence';

function statusLabel(status: LocalStorageProtectionStatus): string {
  if (status === 'persistent') return 'Włączona';
  if (status === 'standard') return 'Standardowa';
  if (status === 'unsupported') return 'Standardowa';
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
      <div className="storage-persistence-copy">
        <strong id="storage-persistence-title">Ochrona danych</strong>
      </div>
      <div className="storage-persistence-status">
        <strong>{statusLabel(status)}</strong>
      </div>
      {status === 'standard' ? <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => void strengthenProtection()}>{busy ? 'Sprawdzam...' : 'Włącz ochronę'}</button> : null}
      
      {message ? <p className="storage-persistence-message" role="status" aria-live="polite">{message}</p> : null}
    </section>
  );
}
