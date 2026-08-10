import { useMemo, useState, type FormEvent } from 'react';
import type { CycleBleedingLevel, CycleJournalEntry, CycleJournalEntryDraft, CyclePainLevel, CycleWellbeingLevel } from './cycle.types';

interface CycleJournalEditorProps {
  entry?: CycleJournalEntry;
  initialDate?: string;
  onSave: (draft: CycleJournalEntryDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

const BLEEDING_OPTIONS: Array<{ value: CycleBleedingLevel; label: string }> = [
  { value: 'NONE', label: 'Brak' },
  { value: 'SPOTTING', label: 'Plamienie' },
  { value: 'LIGHT', label: 'Lekkie' },
  { value: 'MODERATE', label: 'Umiarkowane' },
  { value: 'HEAVY', label: 'Obfite' },
];

const PAIN_OPTIONS: Array<{ value: CyclePainLevel; label: string }> = [
  { value: 'NONE', label: 'Brak' },
  { value: 'MILD', label: 'Łagodny' },
  { value: 'MODERATE', label: 'Umiarkowany' },
  { value: 'STRONG', label: 'Silny' },
];

const WELLBEING_OPTIONS: Array<{ value: CycleWellbeingLevel; label: string }> = [
  { value: 'GOOD', label: 'Dobre' },
  { value: 'NEUTRAL', label: 'Neutralne' },
  { value: 'LOW', label: 'Gorsze' },
];

export function CycleJournalEditor({ entry, initialDate = '', onSave, onDelete, onCancel }: CycleJournalEditorProps) {
  const [date, setDate] = useState(entry?.date ?? initialDate);
  const [bleeding, setBleeding] = useState<CycleBleedingLevel | undefined>(entry?.bleeding);
  const [pain, setPain] = useState<CyclePainLevel | undefined>(entry?.pain);
  const [painMedicationTaken, setPainMedicationTaken] = useState<boolean | undefined>(entry?.painMedicationTaken);
  const [wellbeing, setWellbeing] = useState<CycleWellbeingLevel | undefined>(entry?.wellbeing);
  const [note, setNote] = useState(entry?.note ?? '');
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
      const trimmedNote = note.trim();
      await onSave({
        date,
        ...(bleeding ? { bleeding } : {}),
        ...(pain ? { pain } : {}),
        ...(painMedicationTaken !== undefined ? { painMedicationTaken } : {}),
        ...(wellbeing ? { wellbeing } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać wpisu dnia.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    if (!window.confirm('Usunąć ten wpis dziennika? Zmianę będzie można cofnąć.')) return;
    setBusy(true);
    setError('');
    try {
      await onDelete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się usunąć wpisu dnia.');
      setBusy(false);
    }
  }

  return (
    <form className="cycle-journal-editor" onSubmit={(event) => void submit(event)}>
      <p className="cycle-editor-note">Dziennik zapisuje Twoje obserwacje. Nie diagnozuje i nie ocenia ich medycznie.</p>
      <label className="field"><span>Data</span><input type="date" value={date} max={today} required onChange={(event) => setDate(event.target.value)} /></label>

      <fieldset className="cycle-journal-choice-group">
        <legend>Krwawienie</legend>{bleeding ? <button type="button" className="text-button cycle-journal-clear" disabled={busy} onClick={() => setBleeding(undefined)}>Wyczyść</button> : null}
        <div className="cycle-journal-choices">
          {BLEEDING_OPTIONS.map((option) => <label className={bleeding === option.value ? 'cycle-journal-choice selected' : 'cycle-journal-choice'} key={option.value}><input type="radio" name="cycle-journal-bleeding" value={option.value} checked={bleeding === option.value} onChange={() => setBleeding(option.value)} /><span>{option.label}</span></label>)}
        </div>
      </fieldset>

      <fieldset className="cycle-journal-choice-group">
        <legend>Ból</legend>{pain ? <button type="button" className="text-button cycle-journal-clear" disabled={busy} onClick={() => setPain(undefined)}>Wyczyść</button> : null}
        <div className="cycle-journal-choices">
          {PAIN_OPTIONS.map((option) => <label className={pain === option.value ? 'cycle-journal-choice selected' : 'cycle-journal-choice'} key={option.value}><input type="radio" name="cycle-journal-pain" value={option.value} checked={pain === option.value} onChange={() => setPain(option.value)} /><span>{option.label}</span></label>)}
        </div>
      </fieldset>

      <fieldset className="cycle-journal-choice-group">
        <legend>Lek przeciwbólowy</legend>{painMedicationTaken !== undefined ? <button type="button" className="text-button cycle-journal-clear" disabled={busy} onClick={() => setPainMedicationTaken(undefined)}>Wyczyść</button> : null}
        <div className="cycle-journal-choices">
          <label className={painMedicationTaken === true ? 'cycle-journal-choice selected' : 'cycle-journal-choice'}><input type="radio" name="cycle-journal-pain-medication" value="yes" checked={painMedicationTaken === true} onChange={() => setPainMedicationTaken(true)} /><span>Tak</span></label>
          <label className={painMedicationTaken === false ? 'cycle-journal-choice selected' : 'cycle-journal-choice'}><input type="radio" name="cycle-journal-pain-medication" value="no" checked={painMedicationTaken === false} onChange={() => setPainMedicationTaken(false)} /><span>Nie</span></label>
        </div>
      </fieldset>

      <fieldset className="cycle-journal-choice-group">
        <legend>Samopoczucie</legend>{wellbeing ? <button type="button" className="text-button cycle-journal-clear" disabled={busy} onClick={() => setWellbeing(undefined)}>Wyczyść</button> : null}
        <div className="cycle-journal-choices">
          {WELLBEING_OPTIONS.map((option) => <label className={wellbeing === option.value ? 'cycle-journal-choice selected' : 'cycle-journal-choice'} key={option.value}><input type="radio" name="cycle-journal-wellbeing" value={option.value} checked={wellbeing === option.value} onChange={() => setWellbeing(option.value)} /><span>{option.label}</span></label>)}
        </div>
      </fieldset>

      <label className="field"><span>Notatka <em>opcjonalnie</em></span><textarea value={note} maxLength={500} rows={4} onChange={(event) => setNote(event.target.value)} placeholder="Krótka obserwacja dnia" /><small>{note.length}/500</small></label>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      <div className="cycle-editor-actions">
        <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Zapisywanie...' : 'Zapisz'}</button>
        <button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Anuluj</button>
        {onDelete ? <button type="button" className="text-button danger-text cycle-delete-action" onClick={() => void remove()} disabled={busy}>Usuń wpis</button> : null}
      </div>
    </form>
  );
}
