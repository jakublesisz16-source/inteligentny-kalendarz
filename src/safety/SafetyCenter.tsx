import { useEffect, useRef, useState } from 'react';
import {
  createBackupFile,
  createRestorePoint,
  deleteRestorePoint,
  emptyTrash,
  inspectBackupText,
  listChangeJournal,
  listRestorePoints,
  listTrashItems,
  permanentlyDeleteTrashItem,
  restoreBackup,
  restoreRestorePoint,
  restoreTrashItem,
  undoChange,
} from '../storage/database';
import type { BackupInspection, ChangeJournalEntry, RestorePoint, TrashItem } from './safety.types';
import { StoragePersistencePanel } from '../settings/StoragePersistencePanel';

interface SafetyCenterProps {
  onDataChanged: () => Promise<void>;
}

type SafetyTab = 'history' | 'trash' | 'restore' | 'backup';
const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function SafetyCenter({ onDataChanged }: SafetyCenterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<SafetyTab>('history');
  const [journal, setJournal] = useState<ChangeJournalEntry[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([]);
  const [restoreName, setRestoreName] = useState('');
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function exportBackup() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const backup = await createBackupFile();
      downloadText(backup.fileName, backup.text);
      await onDataChanged();
      setMessage(`Utworzono backup: ${backup.summary.events} wydarzeń, ${backup.summary.universityImports} importów studiów, ${backup.summary.workScheduleImports} grafików pracy, ${backup.summary.shoppingItems} pozycji zakupów, ${backup.summary.cyclePeriods} wpisów historii cyklu i ${backup.summary.cycleJournalEntries} wpisów dziennika Cyklu.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się utworzyć backupu.');
    } finally {
      setBusy(false);
    }
  }

  async function loadBackup(file: File) {
    setBusy(true);
    setError('');
    setMessage('');
    setInspection(null);
    try {
      if (file.size > MAX_BACKUP_FILE_BYTES) throw new Error('Backup jest zbyt duży, aby bezpiecznie wczytać go do pamięci. Maksymalny rozmiar to 25 MB.');
      const text = await file.text();
      setInspection(await inspectBackupText(text));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się sprawdzić backupu.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <section className="panel safety-center">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Dane i prywatność</p>
          <h2>Centrum bezpieczeństwa</h2>
          <p className="panel-copy">Cofaj pomyłki, odzyskuj usunięte elementy i twórz lokalne kopie zapasowe.</p>
        </div>
      </div>

      <StoragePersistencePanel />

      <div className="safety-tabs" role="tablist" aria-label="Bezpieczeństwo danych">
        <button type="button" className={tab === 'history' ? 'filter-button active' : 'filter-button'} onClick={() => setTab('history')}>Historia ({journal.length})</button>
        <button type="button" className={tab === 'trash' ? 'filter-button active' : 'filter-button'} onClick={() => setTab('trash')}>Kosz ({trash.length})</button>
        <button type="button" className={tab === 'restore' ? 'filter-button active' : 'filter-button'} onClick={() => setTab('restore')}>Punkty ({restorePoints.length})</button>
        <button type="button" className={tab === 'backup' ? 'filter-button active' : 'filter-button'} onClick={() => setTab('backup')}>Backup</button>
      </div>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}

      {tab === 'history' ? (
        <div className="safety-list">
          {journal.length ? journal.map((entry) => (
            <article key={entry.id} className="safety-list-item">
              <div><strong>{entry.description}</strong><span>{formatDateTime(entry.timestamp)}</span>{entry.undoneAt ? <small>Cofnięto: {formatDateTime(entry.undoneAt)}</small> : null}</div>
              {entry.reversible && !entry.undoneAt ? <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => void run(() => undoChange(entry.id), 'Cofnięto zmianę.')}>Cofnij</button> : <span className="history-status">Tylko historia</span>}
            </article>
          )) : <p className="muted-copy">Historia jest pusta. Nowe istotne operacje będą zapisywane tutaj.</p>}
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

      {tab === 'backup' ? (
        <div className="safety-stack">
          <div className="backup-warning"><strong>Backup jest lokalny i nieszyfrowany.</strong><span>Może zawierać wydarzenia, lokalizacje, dane planu, profil pracy oraz - jeśli ta opcja jest włączona - minimalne dane zespołu z grafiku, a także zapisane plany dyspozycyjności, listę zakupów i prywatną historię cyklu. Checksum wykrywa uszkodzenie pliku, ale nie ukrywa jego treści.</span></div>
          <div className="backup-actions">
            <button type="button" className="button button-primary" disabled={busy} onClick={() => void exportBackup()}>Utwórz kopię zapasową</button>
            <input ref={fileInputRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadBackup(file); }} />
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => fileInputRef.current?.click()}>Wybierz backup do przywrócenia</button>
          </div>
          {inspection ? (
            <div className="backup-inspection">
              <div><span>Backup</span><strong>{formatDateTime(inspection.summary.createdAt)}</strong></div>
              <div><span>Wydarzenia</span><strong>{inspection.summary.events}</strong></div>
              <div><span>Lokalizacje</span><strong>{inspection.summary.locations}</strong></div>
              <div><span>Importy studiów</span><strong>{inspection.summary.universityImports}</strong></div>
              <div><span>Kosz</span><strong>{inspection.summary.trashItems}</strong></div>
              <div><span>Dni bez dyspozycji</span><strong>{inspection.summary.dayConstraints}</strong></div>
              <div><span>Profile podglądowe</span><strong>{inspection.summary.studyPreviewProfiles}</strong></div>
              <div><span>Grafiki pracy</span><strong>{inspection.summary.workScheduleImports}</strong></div>
              <div><span>Wpisy pracy</span><strong>{inspection.summary.workScheduleEntries}</strong></div>
              <div><span>Zmiany zespołu</span><strong>{inspection.summary.workCoworkerShifts}</strong></div>
              <div><span>Plany dyspozycyjności</span><strong>{inspection.summary.availabilityPlans}</strong></div>
              <div><span>Zakupy</span><strong>{inspection.summary.shoppingItems}</strong></div>
              <div><span>Historia cyklu</span><strong>{inspection.summary.cyclePeriods}</strong></div>
              <div><span>Dziennik cyklu</span><strong>{inspection.summary.cycleJournalEntries}</strong></div>
              <div className="backup-restore-confirm"><p>Przywrócenie zastąpi aktualne dane. Przed operacją aplikacja automatycznie zapisze bieżący stan.</p><button type="button" className="button button-primary" disabled={busy} onClick={() => { if (window.confirm('Przywrócić ten backup i zastąpić aktualne dane?')) void run(async () => { await restoreBackup(inspection.document); setInspection(null); }, 'Backup został przywrócony.'); }}>Przywróć ten backup</button></div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
