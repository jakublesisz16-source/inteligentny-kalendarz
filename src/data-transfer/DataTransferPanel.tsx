import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createCanonicalDataTransferDocument, createDataTransferFile, getCurrentDataTransferSummary, importDataTransfer, inspectDataTransferText } from '../storage/database';
import type { BackupInspection, BackupSummary } from '../safety/safety.types';
import { createExcelExportFile, downloadExcelFile } from './excel-export';

interface DataTransferPanelProps {
  onDataChanged: () => Promise<void>;
}

const MAX_TRANSFER_FILE_BYTES = 25 * 1024 * 1024;

const TRANSFER_COMPARISON_ROWS: Array<{ key: keyof BackupSummary; label: string }> = [
  { key: 'events', label: 'Wydarzenia' },
  { key: 'universityImports', label: 'Importy studiów' },
  { key: 'workScheduleEntries', label: 'Zmiany pracy' },
  { key: 'availabilityPlans', label: 'Dyspozycyjność' },
  { key: 'shoppingItems', label: 'Lista zakupów' },
  { key: 'receipts', label: 'Paragony' },
  { key: 'cyclePeriods', label: 'Historia cyklu' },
  { key: 'cycleJournalEntries', label: 'Dziennik cyklu' },
];

function countFromSummary(summary: BackupSummary, key: keyof BackupSummary): number {
  const value = summary[key];
  return typeof value === 'number' ? value : 0;
}

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
  const [currentSummary, setCurrentSummary] = useState<BackupSummary | null>(null);
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

  async function exportExcel() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const document = await createCanonicalDataTransferDocument();
      const file = await createExcelExportFile(document);
      downloadExcelFile(file);
      setMessage('Plik Excel został przygotowany. Zawiera lokalny eksport danych aplikacji i nie został wysłany do internetu.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się przygotować pliku Excel. Dane w aplikacji nie zostały zmienione.');
    } finally {
      setBusy(false);
    }
  }

  async function inspectFile(file: File) {
    setBusy(true);
    setMessage('');
    setError('');
    setInspection(null);
    setCurrentSummary(null);
    setConfirming(false);
    try {
      if (file.size > MAX_TRANSFER_FILE_BYTES) throw new Error('Plik jest zbyt duży, aby bezpiecznie go zaimportować.');
      const text = await file.text();
      const [next, deviceSummary] = await Promise.all([inspectDataTransferText(text), getCurrentDataTransferSummary()]);
      setInspection(next);
      setCurrentSummary(deviceSummary);
      setFileName(file.name);
    } catch (cause) {
      setFileName('');
      setCurrentSummary(null);
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
      setCurrentSummary(null);
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
          <h3 id="data-transfer-title">Przenieś cały stan aplikacji</h3>
          <p>Eksportuj kopię, przenieś ją na drugie urządzenie i zaimportuj lokalnie.</p>
        </div>
      </div>

      <div className="data-transfer-actions">
        <button type="button" className="button button-primary" disabled={busy} onClick={() => void exportData()}>Eksportuj moje dane</button>
        <button type="button" className="button button-secondary" disabled={busy} onClick={() => void exportExcel()}>Eksportuj do Excela</button>
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

      <details className="data-transfer-privacy-details">
        <summary>Informacje o bezpieczeństwie eksportu</summary>
        <p className="data-transfer-privacy">JSON służy do backupu i przywracania. Excel jest czytelnym archiwum i nie można go importować z powrotem. Pliki mogą zawierać prywatne dane, nie są szyfrowane i powinny być przechowywane w bezpiecznym miejscu. Aplikacja nie wysyła ich do internetu.</p>
      </details>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status" aria-live="polite">{message}</div> : null}
      {busy ? <p className="muted-copy" role="status" aria-live="polite">Przetwarzanie danych / przygotowywanie pliku...</p> : null}

      {inspection ? (
        <div className="data-transfer-preview">
          <div className="data-transfer-preview-title">
            <div>
              <span>Wybrany plik</span>
              <strong>{fileName}</strong>
            </div>
            <button type="button" className="text-button" disabled={busy} onClick={() => { setInspection(null); setCurrentSummary(null); setFileName(''); setConfirming(false); }}>Anuluj</button>
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
            <div><span>Lista zakupów</span><strong>{inspection.summary.shoppingItems}</strong></div>
            <div><span>Paragony</span><strong>{inspection.summary.receipts}</strong></div>
            <div><span>Kategorie wydatków</span><strong>{inspection.summary.expenseCategories}</strong></div>
            <div><span>Produkty finansów</span><strong>{inspection.summary.expenseProducts}</strong></div>
            <div><span>Historia cyklu</span><strong>{inspection.summary.cyclePeriods} wpisów</strong></div>
            <div><span>Dziennik cyklu</span><strong>{inspection.summary.cycleJournalEntries} wpisów</strong></div>
          </div>

          {currentSummary ? (() => {
            const decreases = TRANSFER_COMPARISON_ROWS.filter(({ key }) => countFromSummary(inspection.summary, key) < countFromSummary(currentSummary, key));
            return (
              <section className="data-transfer-comparison" aria-label="Porównanie danych urządzenia z plikiem">
                <div className="data-transfer-comparison-heading">
                  <div><strong>Co zostanie zastąpione</strong><span>Na urządzeniu → w pliku</span></div>
                  {decreases.length ? <span className="data-transfer-reduction-badge">Mniej danych w {decreases.length} {decreases.length === 1 ? 'obszarze' : 'obszarach'}</span> : <span className="data-transfer-neutral-badge">Bez spadku w głównych danych</span>}
                </div>
                <div className="data-transfer-comparison-grid">
                  {TRANSFER_COMPARISON_ROWS.map(({ key, label }) => {
                    const current = countFromSummary(currentSummary, key);
                    const incoming = countFromSummary(inspection.summary, key);
                    return <div className={incoming < current ? 'is-reduction' : ''} key={String(key)}><span>{label}</span><strong><b>{current}</b><i aria-hidden="true">→</i><b>{incoming}</b></strong></div>;
                  })}
                </div>
                {decreases.length ? <p className="data-transfer-reduction-warning" role="status">Plik zawiera mniej danych niż to urządzenie w: {decreases.map((item) => item.label).join(', ')}. To może być poprawny starszy backup, ale po imporcie obecny stan zostanie zastąpiony. Punkt przywracania pozwoli wrócić do stanu sprzed importu.</p> : null}
              </section>
            );
          })() : null}

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
