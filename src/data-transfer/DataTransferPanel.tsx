import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createDataTransferFile, importDataTransfer, inspectDataTransferText } from '../storage/database';
import type { BackupInspection } from '../safety/safety.types';

interface DataTransferPanelProps {
  onDataChanged: () => Promise<void>;
}

const MAX_TRANSFER_FILE_BYTES = 25 * 1024 * 1024;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
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

export function DataTransferPanel({ onDataChanged }: DataTransferPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [fileName, setFileName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!confirming) return;
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setConfirming(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirming, busy]);

  async function exportData() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const transfer = await createDataTransferFile();
      downloadText(transfer.fileName, transfer.text);
      await onDataChanged();
      setMessage('Plik danych został utworzony. Możesz przenieść go na inne urządzenie i zaimportować lokalnie.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się utworzyć pliku danych.');
    } finally {
      setBusy(false);
    }
  }

  async function inspectFile(file: File) {
    setBusy(true);
    setMessage('');
    setError('');
    setInspection(null);
    setConfirming(false);
    try {
      if (file.size > MAX_TRANSFER_FILE_BYTES) throw new Error('Plik jest zbyt duży, aby bezpiecznie go zaimportować.');
      const text = await file.text();
      const next = await inspectDataTransferText(text);
      setInspection(next);
      setFileName(file.name);
    } catch (cause) {
      setFileName('');
      setError(cause instanceof Error ? cause.message : 'Nie udało się sprawdzić pliku danych.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function confirmImport() {
    if (!inspection) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await importDataTransfer(inspection.document);
      try { await onDataChanged(); } catch { /* import is already verified; UI refresh can retry on navigation/reload */ }
      setInspection(null);
      setConfirming(false);
      setFileName('');
      setMessage('Dane zostały przeniesione. Utworzono też punkt przywracania stanu sprzed importu.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zaimportować danych.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="data-transfer-panel" aria-labelledby="data-transfer-title">
      <div className="data-transfer-heading">
        <div>
          <p className="section-kicker">Przenoszenie danych</p>
          <h3 id="data-transfer-title">Przenieś cały stan aplikacji</h3>
          <p>Eksportuj jeden plik na tym urządzeniu, a następnie zaimportuj go na drugim. To ręczny transfer, nie synchronizacja w chmurze.</p>
        </div>
      </div>

      <div className="data-transfer-actions">
        <button type="button" className="button button-primary" disabled={busy} onClick={() => void exportData()}>Eksportuj moje dane</button>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          aria-label="Wybierz plik danych Inteligentnego Kalendarza"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) void inspectFile(file);
          }}
        />
        <button type="button" className="button button-secondary" disabled={busy} onClick={() => fileInputRef.current?.click()}>Importuj dane</button>
      </div>

      <p className="data-transfer-privacy">Plik zawiera prywatne dane z aplikacji, w tym historię i Dziennik Cyklu, i nie jest szyfrowany. Przechowuj go w bezpiecznym miejscu. Aplikacja nie wysyła go do internetu.</p>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status" aria-live="polite">{message}</div> : null}
      {busy ? <p className="muted-copy" role="status" aria-live="polite">Przetwarzanie danych...</p> : null}

      {inspection ? (
        <div className="data-transfer-preview">
          <div className="data-transfer-preview-title">
            <div>
              <span>Wybrany plik</span>
              <strong>{fileName}</strong>
            </div>
            <button type="button" className="text-button" disabled={busy} onClick={() => { setInspection(null); setFileName(''); setConfirming(false); }}>Anuluj</button>
          </div>

          <div className="data-transfer-meta">
            <div><span>Plik z</span><strong>{formatDateTime(inspection.summary.createdAt)}</strong></div>
            <div><span>Wersja aplikacji</span><strong>{inspection.summary.appVersion}</strong></div>
            <div><span>Schemat danych</span><strong>{inspection.summary.databaseSchemaVersion}</strong></div>
            <div><span>Format pliku</span><strong>{inspection.document.backupVersion}</strong></div>
          </div>

          <div className="data-transfer-counts" aria-label="Zawartość pliku danych">
            <div><span>Wydarzenia</span><strong>{inspection.summary.events}</strong></div>
            <div><span>Plany/importy studiów</span><strong>{inspection.summary.universityImports}</strong></div>
            <div><span>Zmiany pracy</span><strong>{inspection.summary.workScheduleEntries}</strong></div>
            <div><span>Plany dyspozycyjności</span><strong>{inspection.summary.availabilityPlans}</strong></div>
            <div><span>Zakupy</span><strong>{inspection.summary.shoppingItems}</strong></div>
            <div><span>Historia cyklu</span><strong>{inspection.summary.cyclePeriods} wpisów</strong></div>
            <div><span>Dziennik cyklu</span><strong>{inspection.summary.cycleJournalEntries} wpisów</strong></div>
          </div>

          {!confirming ? (
            <div className="data-transfer-import-row">
              <p>Podgląd nie zmienił jeszcze żadnych danych na tym urządzeniu.</p>
              <button type="button" className="button button-primary" disabled={busy} onClick={() => setConfirming(true)}>Importuj na to urządzenie</button>
            </div>
          ) : (
            <div className="data-transfer-confirm" role="alertdialog" aria-modal="true" aria-labelledby="data-transfer-confirm-title">
              <div>
                <strong id="data-transfer-confirm-title">Zastąpić dane na tym urządzeniu?</strong>
                <p>Import zastąpi aktualny logiczny stan aplikacji. Przed operacją automatycznie utworzymy punkt przywracania.</p>
              </div>
              <div className="data-transfer-confirm-actions">
                <button ref={confirmRef} type="button" className="button button-primary" disabled={busy} onClick={() => void confirmImport()}>Zastąp i importuj</button>
                <button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirming(false)}>Anuluj</button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
