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
  mode?: 'manual' | 'automation';
  onSaved: () => Promise<void>;
  onClose: () => void;
}

function minutesLabel(value: number): string {
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m ? `${h ? `${h} h ` : ''}${m} min` : `${h} h`;
}

export function DayAvailabilityEditor({ date, blockId, mode = 'manual', onSaved, onClose }: Props) {
  const [overview, setOverview] = useState<AvailabilityDayOverview | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [earliestTime, setEarliestTime] = useState('');
  const [latestTime, setLatestTime] = useState('');
  const [excluded, setExcluded] = useState(false);
  const [blockedIntervals, setBlockedIntervals] = useState<AvailabilityBlockedInterval[]>([]);
  const [newBlockedStart, setNewBlockedStart] = useState('');
  const [newBlockedEnd, setNewBlockedEnd] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
        // Nowy wpis zaczyna się od pustych godzin - użytkownik wpisuje tylko swój zakres.
        setStartTime('');
        setEndTime('');
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się odczytać dyspozycyjności dnia.'); }
  }

  const currentBlock = useMemo(() => blockId ? overview?.blocks.find((block) => block.id === blockId) : undefined, [overview, blockId]);
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

  if (mode === 'automation') {
    return <div className="day-availability-editor day-automation-editor">
      <div className="day-availability-intro"><span className="section-kicker">{dayLabel}</span><h3>Ustawienia automatu dla dnia</h3><p className="muted-copy">Opcjonalne wyjątki używane tylko przy automatycznym szukaniu wolnych godzin.</p></div>
      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}

      {excluded ? <div className="availability-day-status"><div><strong>Ten dzień jest wyłączony z automatu</strong><span>Ręczna dyspozycyjność nadal może być wpisywana niezależnie.</span></div><button type="button" className="button button-secondary button-small" disabled={saving} onClick={() => void saveRule(false, false)}>Przywróć w automacie</button></div> : <>
        <div className="form-grid two-columns"><label className="field"><span>Najwcześniej od</span><input type="time" value={earliestTime} onChange={(e) => setEarliestTime(e.target.value)} /></label><label className="field"><span>Najpóźniej do</span><input type="time" value={latestTime} onChange={(e) => setLatestTime(e.target.value)} /></label></div>
        <div className="availability-blocked-hours"><strong>Dodatkowo niedostępne godziny</strong>{blockedIntervals.length ? <div className="availability-blocked-list">{blockedIntervals.map((item) => <span key={item.id}>{item.startTime}-{item.endTime}<button type="button" aria-label={`Usuń niedostępny przedział ${item.startTime}-${item.endTime}`} onClick={() => setBlockedIntervals((current) => current.filter((entry) => entry.id !== item.id))}>×</button></span>)}</div> : <small>Brak dodatkowych blokad.</small>}<div className="availability-blocked-add"><input aria-label="Niedostępna od" type="time" value={newBlockedStart} onChange={(e) => setNewBlockedStart(e.target.value)} /><input aria-label="Niedostępna do" type="time" value={newBlockedEnd} onChange={(e) => setNewBlockedEnd(e.target.value)} /><button type="button" className="button button-secondary button-small" onClick={addBlocked}>Dodaj</button></div></div>
        <div className="day-availability-actions automation-day-actions"><button type="button" className="button button-primary" disabled={saving} onClick={() => void saveRule()}>Zapisz wyjątki</button><button type="button" className="text-button warning-text" disabled={saving} onClick={() => void saveRule(false, true)}>Wyklucz cały dzień</button></div>
      </>}
    </div>;
  }

  return <div className="day-availability-editor day-manual-availability-editor">
    <div className="day-availability-intro"><span className="section-kicker">{dayLabel}</span><h3>{currentBlock ? 'Edytuj godziny' : 'Dodaj godziny'}</h3></div>
    {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
    {message ? <div className="study-message success-message" role="status">{message}</div> : null}

    {overview?.isSunday && !overview.tradingSunday ? <div className="availability-sunday-note"><span>Ta niedziela nie jest oznaczona jako handlowa.</span><button type="button" className="button button-secondary button-small" onClick={() => void markSundayTrading()}>Oznacz jako handlową</button></div> : null}

    <section className="availability-manual-entry availability-manual-primary">
      <div><strong>{currentBlock ? 'Zmień zapisany zakres' : 'Wpisz, kiedy możesz pracować'}</strong><p className="muted-copy">Aplikacja sprawdzi kolizje z zajęciami, pracą i innymi wydarzeniami.</p></div>
      <div className="form-grid two-columns"><label className="field"><span>Od</span><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label><label className="field"><span>Do</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label></div>
      {overview?.safeIntervals.length ? <div className="availability-calendar-hint"><span>Wolne okna w kalendarzu:</span><div>{overview.safeIntervals.map((interval) => <strong key={`${interval.startTime}-${interval.endTime}`}>{interval.startTime}-{interval.endTime} <small>{minutesLabel(interval.minutes)}</small></strong>)}</div></div> : <p className="availability-calendar-hint-text">Brak bezpiecznego wolnego okna w kalendarzu.</p>}
      <div className="day-availability-actions"><button type="button" className="button button-primary" disabled={saving || !startTime || !endTime} onClick={() => void saveBlock()}>{currentBlock ? 'Zapisz zmiany' : 'Zapisz dyspozycyjność'}</button>{currentBlock ? <button type="button" className="button button-secondary" disabled={saving} onClick={() => void run(() => removeAvailabilityBlock(overview?.weekStart ?? '', currentBlock.id), 'Usunięto dyspozycyjność.', true)}>Usuń</button> : <button type="button" className="text-button" onClick={onClose}>Anuluj</button>}</div>
      {currentBlock?.validationState === 'CONFLICT' ? <div className="availability-conflict-note" role="alert">{currentBlock.validationMessage ?? 'Ten blok wymaga poprawy.'}</div> : null}
      {excluded ? <p className="availability-manual-auto-note">Ten dzień jest wyłączony tylko z automatu. Ręczny zakres zostanie zapisany normalnie.</p> : null}
    </section>
  </div>;
}
