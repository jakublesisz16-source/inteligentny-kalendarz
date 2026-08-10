import { useEffect, useState } from 'react';
import { applyStudyCorrection, getStudyCorrectionContext } from '../storage/database';
import type { CalendarEvent } from '../events/event.types';
import type { StudyCorrectionContext } from '../storage/database';
import type { StudyCorrectionField } from './study.types';

interface StudyEventCorrectionProps {
  event: CalendarEvent;
  onSaved: (count: number) => Promise<void>;
  onCancel: () => void;
}

const FIELD_LABELS: Record<StudyCorrectionField, string> = {
  address: 'Dokładny adres',
  room: 'Sala',
  clinic: 'Klinika',
  locationLabel: 'Nazwa lokalizacji',
};

export function StudyEventCorrection({ event, onSaved, onCancel }: StudyEventCorrectionProps) {
  const [context, setContext] = useState<StudyCorrectionContext | null>(null);
  const [field, setField] = useState<StudyCorrectionField>('address');
  const [value, setValue] = useState('');
  const [scope, setScope] = useState<'SINGLE' | 'SERIES'>('SINGLE');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await getStudyCorrectionContext(event.id);
        if (!loaded) {
          setError('To wydarzenie nie ma już danych źródłowych potrzebnych do poprawki serii.');
          return;
        }
        setContext(loaded);
        const first = loaded.missingFields[0] ?? 'address';
        setField(first);
        setScope((loaded.affectedCounts[first] ?? 0) > 1 ? 'SERIES' : 'SINGLE');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Nie udało się odczytać danych zajęcia.');
      } finally {
        setLoading(false);
      }
    })();
  }, [event.id]);

  async function save() {
    if (!value.trim()) {
      setError('Uzupełnij wartość.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const count = await applyStudyCorrection({ eventId: event.id, field, value, scope });
      await onSaved(count);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się zapisać poprawki.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted-copy">Odczytuję powiązane zajęcia...</p>;

  return (
    <div className="form-stack study-correction-form">
      <div className="source-edit-note">
        <strong>{event.title}</strong>
        <span>Ta poprawka korzysta z identyfikatora serii, a nie z samego tytułu przedmiotu.</span>
      </div>
      {error ? <div className="inline-error">{error}</div> : null}
      {context ? (
        <>
          <label className="field full-field">
            <span>Uzupełnij pole</span>
            <select value={field} onChange={(e) => { const nextField = e.target.value as StudyCorrectionField; setField(nextField); setValue(''); setScope((context.affectedCounts[nextField] ?? 0) > 1 ? 'SERIES' : 'SINGLE'); }}>
              {(context.missingFields.length ? context.missingFields : (['address', 'room', 'clinic', 'locationLabel'] as StudyCorrectionField[])).map((item) => <option key={item} value={item}>{FIELD_LABELS[item]}</option>)}
            </select>
          </label>
          <label className="field full-field"><span>{FIELD_LABELS[field]}</span><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Wpisz brakującą wartość" /></label>
          {(context.affectedCounts[field] ?? 0) > 1 ? (
            <div className="correction-scope">
              <strong>Zakres poprawki</strong>
              <label className={`correction-scope-option${scope === 'SERIES' ? ' selected' : ''}`}><input type="radio" name="correction-scope" checked={scope === 'SERIES'} onChange={() => setScope('SERIES')} /><span>Zastosuj do powiązanych zajęć z tym samym brakiem ({context.affectedCounts[field] ?? 1} wydarzeń)</span></label>
              <label className={`correction-scope-option${scope === 'SINGLE' ? ' selected' : ''}`}><input type="radio" name="correction-scope" checked={scope === 'SINGLE'} onChange={() => setScope('SINGLE')} /><span>Tylko to wydarzenie</span></label>
            </div>
          ) : null}
          <p className="muted-copy">Zbiorczo aktualizujemy wyłącznie brakujące bezpieczne dane lokalizacji. Istniejąca inna wartość w powiązanym terminie nie zostanie nadpisana.</p>
          <div className="modal-actions action-group"><button type="button" className="button button-secondary" onClick={onCancel}>Anuluj</button><button type="button" className="button button-primary" disabled={saving} onClick={() => void save()}>{saving ? 'Zapisuję...' : scope === 'SERIES' ? 'Zastosuj poprawkę do serii' : 'Zapisz poprawkę'}</button></div>
        </>
      ) : null}
    </div>
  );
}
