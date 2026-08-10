import { useMemo, useState, type FormEvent } from 'react';
import type { CyclePeriod, CyclePeriodDraft } from './cycle.types';

interface CyclePeriodEditorProps {
  period?: CyclePeriod;
  initialStartDate?: string;
  onSave: (draft: CyclePeriodDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

export function CyclePeriodEditor({ period, initialStartDate = '', onSave, onDelete, onCancel }: CyclePeriodEditorProps) {
  const [startDate, setStartDate] = useState(period?.startDate ?? initialStartDate);
  const [endDate, setEndDate] = useState(period?.endDate ?? '');
  const [atypical, setAtypical] = useState(Boolean(period?.isUserMarkedAtypical));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const today = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ startDate, ...(endDate ? { endDate } : {}), ...(atypical ? { isUserMarkedAtypical: true } : {}) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać wpisu cyklu.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    if (!window.confirm('Usunąć ten wpis z historii cyklu? Zmianę będzie można cofnąć z historii zmian.')) return;
    setBusy(true);
    setError('');
    try {
      await onDelete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się usunąć wpisu.');
      setBusy(false);
    }
  }

  return (
    <form className="cycle-editor" onSubmit={(event) => void submit(event)}>
      <p className="cycle-editor-note">Początek oznacza pierwszy dzień miesiączki. Koniec jest opcjonalny i nie wpływa na długość cyklu.</p>
      <div className="form-grid two-columns">
        <label className="field"><span>Początek</span><input type="date" value={startDate} max={today} required onChange={(event) => setStartDate(event.target.value)} /></label>
        <label className="field"><span>Koniec <em>opcjonalnie</em></span><input type="date" value={endDate} min={startDate || undefined} max={today} onChange={(event) => setEndDate(event.target.value)} /></label>
      </div>
      <label className="cycle-atypical-toggle"><input type="checkbox" checked={atypical} onChange={(event) => setAtypical(event.target.checked)} /><span><strong>Ten cykl był dla mnie nietypowy</strong><small>To tylko informacja w historii. Nie zmienia matematycznej wagi wpisu.</small></span></label>
      {!period ? <p className="muted-copy">Dodawaj wcześniejsze daty tylko wtedy, gdy jesteś ich w miarę pewna. Nie musisz uzupełniać każdego miesiąca.</p> : null}
      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      <div className="cycle-editor-actions">
        <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Zapisywanie...' : 'Zapisz'}</button>
        <button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Anuluj</button>
        {onDelete ? <button type="button" className="text-button danger-text cycle-delete-action" onClick={() => void remove()} disabled={busy}>Usuń wpis</button> : null}
      </div>
    </form>
  );
}
