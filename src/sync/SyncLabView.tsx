import { useEffect, useMemo, useState } from 'react';
import {
  getSyncLabDeviceId,
  readableFirebaseError,
  signInSyncLabWithGoogle,
  signOutSyncLab,
  subscribeToSyncLabPing,
  subscribeToSyncLabUser,
  SYNC_LAB_FIREBASE_PROJECT_ID,
  warmSyncLabRuntime,
  writeSyncLabPing,
  type SyncLabPing,
  type SyncLabUser,
} from './firebase-client';
import '../styles/sync-lab.css';

type LabStatus = 'loading' | 'ready' | 'signing-in' | 'saving';

function formatUpdatedAt(value: string | null): string {
  if (!value) return 'czekam na potwierdzenie serwera';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
}

export function SyncLabView() {
  const [status, setStatus] = useState<LabStatus>('loading');
  const [user, setUser] = useState<SyncLabUser | null>(null);
  const [ping, setPing] = useState<SyncLabPing | null>(null);
  const [text, setText] = useState('Test synchronizacji');
  const [error, setError] = useState('');
  const deviceId = useMemo(() => getSyncLabDeviceId(), []);
  const normalAppHref = window.location.pathname || './';

  useEffect(() => {
    document.title = 'Sync Lab - Inteligentny Kalendarz';
    let disposed = false;
    let stopAuth: (() => void) | undefined;

    void warmSyncLabRuntime()
      .then(() => subscribeToSyncLabUser(
        (nextUser) => {
          if (disposed) return;
          setUser(nextUser);
          setStatus('ready');
          setError('');
        },
        (cause) => {
          if (disposed) return;
          setError(readableFirebaseError(cause));
          setStatus('ready');
        },
      ))
      .then((unsubscribe) => {
        if (disposed) unsubscribe();
        else stopAuth = unsubscribe;
      })
      .catch((cause) => {
        if (disposed) return;
        setError(readableFirebaseError(cause));
        setStatus('ready');
      });

    return () => {
      disposed = true;
      stopAuth?.();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setPing(null);
      return;
    }

    let disposed = false;
    let stopPing: (() => void) | undefined;

    void subscribeToSyncLabPing(
      user.uid,
      (nextPing) => {
        if (!disposed) {
          setPing(nextPing);
          setError('');
        }
      },
      (cause) => {
        if (!disposed) setError(readableFirebaseError(cause));
      },
    )
      .then((unsubscribe) => {
        if (disposed) unsubscribe();
        else stopPing = unsubscribe;
      })
      .catch((cause) => {
        if (!disposed) setError(readableFirebaseError(cause));
      });

    return () => {
      disposed = true;
      stopPing?.();
    };
  }, [user?.uid]);

  async function signIn() {
    setStatus('signing-in');
    setError('');
    try {
      const nextUser = await signInSyncLabWithGoogle();
      setUser(nextUser);
    } catch (cause) {
      setError(readableFirebaseError(cause));
    } finally {
      setStatus('ready');
    }
  }

  async function signOut() {
    setError('');
    try {
      await signOutSyncLab();
      setUser(null);
      setPing(null);
    } catch (cause) {
      setError(readableFirebaseError(cause));
    }
  }

  async function savePing() {
    if (!user || !text.trim()) return;
    setStatus('saving');
    setError('');
    try {
      await writeSyncLabPing(user.uid, text.trim());
    } catch (cause) {
      setError(readableFirebaseError(cause));
    } finally {
      setStatus('ready');
    }
  }

  return (
    <main className="sync-lab-shell">
      <section className="sync-lab-card" aria-labelledby="sync-lab-title">
        <header className="sync-lab-header">
          <div>
            <p className="sync-lab-kicker">Eksperymentalna ścieżka</p>
            <h1 id="sync-lab-title">Sync Lab 0.1</h1>
            <p>Testujemy tylko logowanie i jeden rekord Firestore. Obecne dane kalendarza i IndexedDB nie są dotykane.</p>
          </div>
          <span className="sync-lab-badge">PoC</span>
        </header>

        <div className="sync-lab-facts" aria-label="Stan eksperymentu">
          <div>
            <span>Projekt</span>
            <strong>{SYNC_LAB_FIREBASE_PROJECT_ID}</strong>
          </div>
          <div>
            <span>Urządzenie</span>
            <strong title={deviceId}>{deviceId.slice(0, 8)}</strong>
          </div>
          <div>
            <span>Lokalne dane aplikacji</span>
            <strong>nietknięte</strong>
          </div>
        </div>

        {error ? <div className="sync-lab-error" role="alert">{error}</div> : null}

        <section className="sync-lab-section">
          <div className="sync-lab-section-copy">
            <span>Krok 1</span>
            <h2>Konto Google</h2>
            <p>To samo konto na telefonie i komputerze powinno widzieć ten sam rekord testowy.</p>
          </div>

          {status === 'loading' ? (
            <button type="button" className="button" disabled>Łączenie z Firebase...</button>
          ) : user ? (
            <div className="sync-lab-account">
              <div>
                <strong>{user.displayName || 'Zalogowano'}</strong>
                <span>{user.email || user.uid}</span>
              </div>
              <button type="button" className="button" onClick={() => void signOut()}>Wyloguj</button>
            </div>
          ) : (
            <button
              type="button"
              className="button button-primary"
              disabled={status === 'signing-in'}
              onClick={() => void signIn()}
            >
              {status === 'signing-in' ? 'Logowanie...' : 'Zaloguj przez Google'}
            </button>
          )}
        </section>

        <section className="sync-lab-section">
          <div className="sync-lab-section-copy">
            <span>Krok 2</span>
            <h2>Jeden rekord w chmurze</h2>
            <p>Ścieżka: users/&lt;uid&gt;/syncTest/ping. Nie synchronizujemy jeszcze wydarzeń, Finansów, Studiów ani Pracy.</p>
          </div>

          <label className="sync-lab-field">
            <span>Tekst testowy</span>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={!user || status === 'saving'}
              maxLength={160}
              placeholder="Np. test z komputera"
            />
          </label>

          <button
            type="button"
            className="button button-primary"
            disabled={!user || !text.trim() || status === 'saving'}
            onClick={() => void savePing()}
          >
            {status === 'saving' ? 'Zapisywanie...' : 'Zapisz test do chmury'}
          </button>
        </section>

        <section className="sync-lab-section sync-lab-result" aria-live="polite">
          <div className="sync-lab-section-copy">
            <span>Krok 3</span>
            <h2>Ostatni rekord z Firestore</h2>
          </div>

          {user ? (
            ping ? (
              <div className="sync-lab-ping">
                <strong>{ping.text || 'Pusty tekst'}</strong>
                <span>Aktualizacja: {formatUpdatedAt(ping.updatedAt)}</span>
                <span>Urządzenie: {ping.updatedByDevice ? ping.updatedByDevice.slice(0, 8) : 'brak identyfikatora'}</span>
              </div>
            ) : (
              <p className="sync-lab-empty">Brak rekordu. Zapisz pierwszy test.</p>
            )
          ) : (
            <p className="sync-lab-empty">Zaloguj się, aby rozpocząć test synchronizacji.</p>
          )}
        </section>

        <footer className="sync-lab-footer">
          <p>Ten ekran jest dostępny tylko po parametrze <code>?syncLab=1</code> na eksperymentalnej gałęzi.</p>
          <a className="button" href={normalAppHref}>Otwórz zwykłą aplikację</a>
        </footer>
      </section>
    </main>
  );
}
