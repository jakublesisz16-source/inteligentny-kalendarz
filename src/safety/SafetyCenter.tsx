import { useEffect, useState } from 'react';
import {
  createRestorePoint,
  deleteRestorePoint,
  emptyTrash,
  listChangeJournal,
  listRestorePoints,
  listTrashItems,
  permanentlyDeleteTrashItem,
  restoreRestorePoint,
  restoreTrashItem,
  undoChange,
} from '../storage/database';
import type { ChangeJournalEntry, RestorePoint, TrashItem } from './safety.types';
import { StoragePersistencePanel } from '../settings/StoragePersistencePanel';

interface SafetyCenterProps {
  onDataChanged: () => Promise<void>;
}

type SafetyTab = 'history' | 'trash' | 'restore';

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}


export function SafetyCenter({ onDataChanged }: SafetyCenterProps) {
  const [tab, setTab] = useState<SafetyTab>('history');
  const [journal, setJournal] = useState<ChangeJournalEntry[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([]);
  const [restoreName, setRestoreName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    const [nextJournal, nextTrash, nextRestore] = await Promise.all([listChangeJournal(), listTrashItems(), listRestorePoints()]);
    setJournal(nextJournal);
    setTrash(nextTrash);
    setRestorePoints(nextRestore);
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await Promise.all([refresh(), onDataChanged()]);
      setMessage(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wykonać operacji.');
    } finally {
      setBusy(false);
    }
  }

  async function createManualPoint() {
    await run(async () => {
      await createRestorePoint(restoreName || 'Ręczny punkt przywracania', 'MANUAL', false, true);
      setRestoreName('');
    }, 'Utworzono punkt przywracania.');
  }


  return (
    <section className="safety-center">
      <p className="settings-section-intro">Cofaj pomyłki, odzyskuj usunięte elementy i wracaj do wcześniejszych stanów.</p>

      <StoragePersistencePanel />

      <div className="safety-tabs" role="tablist" aria-label="Bezpieczeństwo danych">
        <button type="button" className={tab === 'history' ? 'filter-button active' : 'filter-button'} onClick={() => setTab('history')}>Historia ({journal.length})</button>
        <button type="button" className={tab === 'trash' ? 'filter-button active' : 'filter-button'} onClick={() => setTab('trash')}>Kosz ({trash.length})</button>
        <button type="button" className={tab === 'restore' ? 'filter-button active' : 'filter-button'} onClick={() => setTab('restore')}>Punkty ({restorePoints.length})</button>
      </div>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}

      {tab === 'history' ? (
        <div className="safety-list">
          {journal.length ? journal.slice(0, showAllHistory ? journal.length : 5).map((entry) => (
            <article key={entry.id} className="safety-list-item">
              <div><strong>{entry.description}</strong><span>{formatDateTime(entry.timestamp)}</span>{entry.undoneAt ? <small>Cofnięto: {formatDateTime(entry.undoneAt)}</small> : null}</div>
              {entry.reversible && !entry.undoneAt ? <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => void run(() => undoChange(entry.id), 'Cofnięto zmianę.')}>Cofnij</button> : <span className="history-status">Tylko historia</span>}
            </article>
          )) : <p className="muted-copy">Historia jest pusta. Nowe istotne operacje będą zapisywane tutaj.</p>}
          {journal.length > 5 ? <button type="button" className="button button-secondary button-small safety-history-toggle" onClick={() => setShowAllHistory((value) => !value)}>{showAllHistory ? 'Pokaż ostatnie 5' : `Pokaż całą historię (${journal.length})`}</button> : null}
        </div>
      ) : null}

      {tab === 'trash' ? (
        <div className="safety-stack">
          {trash.length ? <div className="safety-list">{trash.map((item) => (
            <article key={item.id} className="safety-list-item">
              <div><strong>{item.displayName}</strong><span>Usunięto {formatDateTime(item.deletedAt)}</span><small>{item.entityType === 'MANUAL_SERIES' ? 'Ręczna seria' : item.entityType === 'DAY_CONSTRAINT' ? 'Ograniczenie dnia' : 'Wydarzenie'}</small></div>
              <div className="safety-item-actions">
                <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => void run(() => restoreTrashItem(item.id), 'Przywrócono element z Kosza.')}>Przywróć</button>
                <button type="button" className="text-button danger-text" disabled={busy} onClick={() => { if (window.confirm('Usunąć trwale? Tej operacji nie będzie można cofnąć z Kosza.')) void run(() => permanentlyDeleteTrashItem(item.id), 'Element usunięto trwale.'); }}>Usuń trwale</button>
              </div>
            </article>
          ))}</div> : <p className="muted-copy">Kosz jest pusty.</p>}
          {trash.length ? <button type="button" className="button button-danger-ghost align-start" disabled={busy} onClick={() => { if (window.confirm(`Opróżnić Kosz (${trash.length} elementów)? Przed operacją powstanie punkt przywracania.`)) void run(emptyTrash, 'Kosz został opróżniony.'); }}>Opróżnij Kosz</button> : null}
        </div>
      ) : null}

      {tab === 'restore' ? (
        <div className="safety-stack">
          <div className="manual-restore-row">
            <label className="field"><span>Nazwa punktu <em>opcjonalnie</em></span><input value={restoreName} onChange={(event) => setRestoreName(event.target.value)} placeholder="Np. Przed większą zmianą" /></label>
            <button type="button" className="button button-primary" disabled={busy} onClick={() => void createManualPoint()}>Utwórz punkt</button>
          </div>
          <div className="safety-list">
            {restorePoints.map((point) => (
              <article key={point.id} className="safety-list-item">
                <div><strong>{point.label}</strong><span>{formatDateTime(point.createdAt)}</span><small>{point.automatic ? 'Automatyczny' : 'Ręczny'}{point.pinned ? ' - chroniony' : ''} - schema {point.schemaVersion}</small></div>
                <div className="safety-item-actions">
                  <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => { if (window.confirm(`Przywrócić punkt „${point.label}”? Najpierw zostanie zapisany bieżący stan.`)) void run(() => restoreRestorePoint(point.id), 'Przywrócono wcześniejszy stan.'); }}>Przywróć</button>
                  {!point.pinned ? <button type="button" className="text-button danger-text" disabled={busy} onClick={() => void run(() => deleteRestorePoint(point.id), 'Usunięto punkt przywracania.')}>Usuń</button> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

    </section>
  );
}
