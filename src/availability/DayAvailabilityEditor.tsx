import { useEffect, useMemo, useState } from 'react';
import { localDateFromKey } from '../calendar/date.utils';
import { setTradingSunday } from '../storage/database';
import {
  addManualAvailabilityBlock,
  AvailabilityDayRuleConflictError,
  AvailabilityOverlapError,
  getAvailabilityDayOverview,
  removeAvailabilityBlock,
  setAvailabilityDayRule,
  updateAvailabilityBlock,
} from './availability.service';
import type { AvailabilityBlockedInterval, AvailabilityDayOverview } from './availability.types';

interface Props {
  date: string;
  blockId?: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
}

function minutesLabel(value: number): string {
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m ? `${h ? `${h} h ` : ''}${m} min` : `${h} h`;
}

export function DayAvailabilityEditor({ date, blockId, onSaved, onClose }: Props) {
  const [overview, setOverview] = useState<AvailabilityDayOverview | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [earliestTime, setEarliestTime] = useState('');
  const [latestTime, setLatestTime] = useState('');
  const [excluded, setExcluded] = useState(false);
  const [blockedIntervals, setBlockedIntervals] = useState<AvailabilityBlockedInterval[]>([]);
  const [newBlockedStart, setNewBlockedStart] = useState('');
  const [newBlockedEnd, setNewBlockedEnd] = useState('');
  const [manualOpen, setManualOpen] = useState(Boolean(blockId));
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setManualOpen(Boolean(blockId));
    setExceptionOpen(false);
    setStartTime('');
    setEndTime('');
    void refresh();
  }, [date, blockId]);

  async function refresh() {
    try {
      const next = await getAvailabilityDayOverview(date);
      setOverview(next);
      setEarliestTime(next.rule?.earliestTime ?? '');
      setLatestTime(next.rule?.latestTime ?? '');
      setExcluded(next.rule?.excluded ?? false);
      setBlockedIntervals(next.rule?.blockedIntervals ?? []);
      const current = blockId ? next.blocks.find((block) => block.id === blockId) : undefined;
      if (current) {
        setStartTime(current.startTime);
        setEndTime(current.endTime);
      } else {
        // Brak ręcznego bloku oznacza automat. Nie wypełniamy formularza godzinami safe window,
        // bo użytkowniczka nie musi ich przepisywać, żeby optimizer zadziałał.
        setStartTime('');
        setEndTime('');
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się odczytać dyspozycyjności dnia.'); }
  }

  const currentBlock = useMemo(() => blockId ? overview?.blocks.find((block) => block.id === blockId) : undefined, [overview, blockId]);
  const hasRule = Boolean(overview?.rule && (overview.rule.excluded || overview.rule.earliestTime || overview.rule.latestTime || overview.rule.blockedIntervals.length));
  const dayLabel = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(localDateFromKey(date));

  async function run(action: () => Promise<unknown>, success: string, close = false) {
    setSaving(true); setError(''); setMessage('');
    try {
      await action();
      await onSaved();
      if (close) onClose();
      else { setMessage(success); await refresh(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać zmian.'); }
    finally { setSaving(false); }
  }

  async function saveBlock(mergeOverlaps = false) {
    setSaving(true); setError(''); setMessage('');
    try {
      if (currentBlock) await updateAvailabilityBlock(overview?.weekStart ?? '', currentBlock.id, 'EDIT', { date, startTime, endTime, mergeOverlaps });
      else await addManualAvailabilityBlock(overview?.weekStart ?? '', { date, startTime, endTime }, mergeOverlaps);
      await onSaved(); onClose();
    } catch (reason) {
      if (reason instanceof AvailabilityOverlapError) {
        const merge = window.confirm(`${reason.message}\n\nScalić te zakresy?`);
        if (merge) { setSaving(false); await saveBlock(true); return; }
      }
      setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać dyspozycyjności.');
    } finally { setSaving(false); }
  }

  async function saveRule(removeExisting = false, excludedOverride?: boolean) {
    if (!overview) return;
    const nextExcluded = excludedOverride ?? excluded;
    setSaving(true); setError(''); setMessage('');
    try {
      await setAvailabilityDayRule(overview.weekStart, { date, excluded: nextExcluded, ...(earliestTime ? { earliestTime } : {}), ...(latestTime ? { latestTime } : {}), blockedIntervals }, removeExisting);
      setExcluded(nextExcluded);
      await onSaved(); setMessage(nextExcluded ? 'Wykluczono ten dzień z automatycznej dyspozycyjności.' : 'Zapisano wyjątki tego dnia.'); await refresh();
    } catch (reason) {
      if (reason instanceof AvailabilityDayRuleConflictError) {
        const remove = window.confirm('Ten dzień ma już zapisaną dyspozycyjność. Usunąć ją i wykluczyć cały dzień?');
        if (remove) { setSaving(false); await saveRule(true, true); return; }
      }
      setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać ograniczeń dnia.');
    } finally { setSaving(false); }
  }

  function addBlocked() {
    setError('');
    if (!newBlockedStart || !newBlockedEnd || newBlockedEnd <= newBlockedStart) { setError('Podaj prawidłowe godziny niedostępnego przedziału.'); return; }
    setBlockedIntervals((current) => [...current, { id: `draft-${Date.now()}`, startTime: newBlockedStart, endTime: newBlockedEnd }]);
    setNewBlockedStart(''); setNewBlockedEnd('');
  }

  async function markSundayTrading() {
    await run(async () => { await setTradingSunday(date, true); }, 'Oznaczono niedzielę handlową.');
  }

  return <div className="day-availability-editor">
    <div className="day-availability-intro"><span className="section-kicker">{dayLabel}</span><h3>{currentBlock ? 'Edytuj dyspozycyjność' : 'Dyspozycyjność dnia'}</h3></div>
    {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
    {message ? <div className="study-message success-message" role="status">{message}</div> : null}

    {overview?.isSunday && !overview.tradingSunday ? <div className="availability-sunday-note"><span>Ta niedziela nie jest oznaczona jako handlowa.</span><button type="button" className="button button-secondary button-small" onClick={() => void markSundayTrading()}>Oznacz jako handlową</button></div> : null}

    <section className="availability-safe-preview">
      <span>Automatycznie możliwe</span>
      {overview?.safeIntervals.length ? <div>{overview.safeIntervals.map((interval) => <strong key={`${interval.startTime}-${interval.endTime}`}>{interval.startTime}-{interval.endTime} <small>{minutesLabel(interval.minutes)}</small></strong>)}</div> : <p>{excluded ? 'Ten dzień jest wykluczony z dyspozycyjności.' : 'Brak bezpiecznego okna w aktualnym kalendarzu i ograniczeniach.'}</p>}
    </section>

    {!currentBlock ? <div className="availability-auto-default">
      <div><strong>Nie musisz wpisywać godzin.</strong><span>Jeśli nic nie zmienisz, aplikacja sama użyje bezpiecznych okien z kalendarza podczas układania dyspozycyjności.</span></div>
      <button type="button" className="button button-primary" onClick={onClose}>Bez zmian - użyj automatu</button>
    </div> : null}

    {excluded ? <div className="availability-day-status"><div><strong>Dyspozycyjność wyłączona</strong><span>Optimizer nie zaproponuje pracy tego dnia.</span></div><button type="button" className="button button-secondary button-small" disabled={saving} onClick={() => void saveRule(false, false)}>Przywróć</button></div> : null}

    {!currentBlock && !excluded ? <div className="day-availability-choice-row">
      <button type="button" className="text-button" aria-expanded={exceptionOpen} onClick={() => setExceptionOpen((value) => !value)}>{exceptionOpen ? 'Ukryj wyjątek' : hasRule ? 'Edytuj wyjątek' : 'Ustaw wyjątek'}</button>
      <button type="button" className="text-button" aria-expanded={manualOpen} onClick={() => setManualOpen((value) => !value)}>{manualOpen ? 'Ukryj ręczny wpis' : 'Wpisz własną dyspozycyjność'}</button>
      <button type="button" className="text-button warning-text" disabled={saving} onClick={() => void saveRule(false, true)}>Wyklucz dzień</button>
    </div> : null}

    {(currentBlock || manualOpen) && !excluded ? <section className="availability-manual-entry">
      {!currentBlock ? <div><strong>Własna dyspozycyjność</strong><p className="muted-copy">Tylko tutaj podajesz dokładne godziny ręcznie. Ten blok zostanie zachowany i optimizer go nie przesunie.</p></div> : null}
      <div className="form-grid two-columns"><label className="field"><span>Od</span><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label><label className="field"><span>Do</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label></div>
      <div className="day-availability-actions"><button type="button" className="button button-primary" disabled={saving || !startTime || !endTime} onClick={() => void saveBlock()}>{currentBlock ? 'Zapisz' : 'Zapisz własną dyspozycyjność'}</button>{currentBlock ? <button type="button" className="button button-secondary" disabled={saving} onClick={() => void run(() => removeAvailabilityBlock(overview?.weekStart ?? '', currentBlock.id), 'Usunięto dyspozycyjność.', true)}>Usuń</button> : <button type="button" className="text-button" onClick={() => { setManualOpen(false); setStartTime(''); setEndTime(''); }}>Anuluj</button>}</div>
      {currentBlock?.validationState === 'CONFLICT' ? <div className="availability-conflict-note" role="alert">{currentBlock.validationMessage ?? 'Ten blok wymaga poprawy.'}</div> : null}
    </section> : null}

    {exceptionOpen && !excluded ? <section className="day-availability-more" aria-label="Wyjątki dyspozycyjności dnia">
      <div className="day-availability-more-body">
        <div><strong>Wyjątek tylko dla tego dnia</strong><p className="muted-copy">Puste pola oznaczają brak wyjątku. Godziny wynikające z zajęć i wydarzeń aplikacja oblicza sama.</p></div>
        <div className="form-grid two-columns"><label className="field"><span>Tego dnia najwcześniej od</span><input type="time" value={earliestTime} onChange={(e) => setEarliestTime(e.target.value)} /></label><label className="field"><span>Tego dnia najpóźniej do</span><input type="time" value={latestTime} onChange={(e) => setLatestTime(e.target.value)} /></label></div>
        <div className="availability-blocked-hours"><strong>Niedostępne godziny</strong>{blockedIntervals.length ? <div className="availability-blocked-list">{blockedIntervals.map((item) => <span key={item.id}>{item.startTime}-{item.endTime}<button type="button" aria-label={`Usuń niedostępny przedział ${item.startTime}-${item.endTime}`} onClick={() => setBlockedIntervals((current) => current.filter((entry) => entry.id !== item.id))}>×</button></span>)}</div> : <small>Brak dodatkowych blokad.</small>}<div className="availability-blocked-add"><input aria-label="Niedostępna od" type="time" value={newBlockedStart} onChange={(e) => setNewBlockedStart(e.target.value)} /><input aria-label="Niedostępna do" type="time" value={newBlockedEnd} onChange={(e) => setNewBlockedEnd(e.target.value)} /><button type="button" className="button button-secondary button-small" onClick={addBlocked}>Dodaj</button></div></div>
        <div className="day-availability-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={() => void saveRule()}>Zapisz wyjątek</button><button type="button" className="text-button" onClick={() => setExceptionOpen(false)}>Anuluj</button></div>
      </div>
    </section> : null}
  </div>;
}
