import { useMemo, useState } from 'react';
import type { CalendarEvent } from '../events/event.types';
import type { StudySeriesTimingMode } from '../storage/database';

interface Props {
  event: CalendarEvent;
  events: CalendarEvent[];
  onApply: (input: { mode: StudySeriesTimingMode; startTime?: string; endTime?: string; shiftMinutes?: number }) => Promise<void>;
  onCancel: () => void;
}
function shift(value: string, minutes: number): string {
  const date = new Date(`${value}:00`);
  date.setMinutes(date.getMinutes() + minutes);
  const y = date.getFullYear(); const m = String(date.getMonth()+1).padStart(2,'0'); const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
export function StudySeriesTimingCorrection({ event, events, onApply, onCancel }: Props) {
  const members = useMemo(() => events.filter((item) => item.source === 'UNIVERSITY_XLSX' && item.seriesKey && item.seriesKey === event.seriesKey).sort((a,b)=>a.startDateTime.localeCompare(b.startDateTime)), [events, event.seriesKey]);
  const [mode, setMode] = useState<StudySeriesTimingMode>('SHIFT_MINUTES');
  const [shiftMinutes, setShiftMinutes] = useState('60');
  const [startTime, setStartTime] = useState(event.startDateTime.slice(11,16));
  const [endTime, setEndTime] = useState(event.endDateTime.slice(11,16));
  const [saving, setSaving] = useState(false);
  const ranges = new Set(members.map((item) => `${item.startDateTime.slice(11,16)}-${item.endDateTime.slice(11,16)}`));
  const preview = members.map((item) => ({ item, nextStart: mode === 'SET_SAME_TIME' ? `${item.startDateTime.slice(0,10)}T${startTime}` : shift(item.startDateTime, Number(shiftMinutes)||0), nextEnd: mode === 'SET_SAME_TIME' ? `${item.startDateTime.slice(0,10)}T${endTime}` : shift(item.endDateTime, Number(shiftMinutes)||0) }));
  async function apply() { setSaving(true); try { await onApply(mode === 'SET_SAME_TIME' ? { mode, startTime, endTime } : { mode, shiftMinutes: Number(shiftMinutes) }); } finally { setSaving(false); } }
  return <div className="form-stack study-series-timing">
    <div className="source-edit-note"><strong>Bezpieczna seria po seriesKey</strong><span>Zmiana obejmie dokładnie {members.length} powiązanych terminów. Seria nie jest dobierana po samym tytule.</span></div>
    <fieldset className="event-mode-picker"><legend>Sposób zmiany godzin</legend><label className={mode === 'SHIFT_MINUTES' ? 'selected' : ''}><input type="radio" checked={mode === 'SHIFT_MINUTES'} onChange={()=>setMode('SHIFT_MINUTES')} /><span><strong>Przesuń o tę samą różnicę</strong><small>Zachowuje różnice pomiędzy nietypowymi terminami.</small></span></label><label className={mode === 'SET_SAME_TIME' ? 'selected' : ''}><input type="radio" checked={mode === 'SET_SAME_TIME'} onChange={()=>setMode('SET_SAME_TIME')} /><span><strong>Ustaw tę samą godzinę</strong><small>Wszystkie terminy dostaną identyczny zakres.</small></span></label></fieldset>
    {mode === 'SHIFT_MINUTES' ? <label className="field"><span>Przesunięcie <em>minuty, może być ujemne</em></span><input type="number" value={shiftMinutes} onChange={(e)=>setShiftMinutes(e.target.value)} /></label> : <div className="form-grid two-columns"><label className="field"><span>Od</span><input type="time" value={startTime} onChange={(e)=>setStartTime(e.target.value)} /></label><label className="field"><span>Do</span><input type="time" value={endTime} onChange={(e)=>setEndTime(e.target.value)} /></label></div>}
    {mode === 'SET_SAME_TIME' && ranges.size > 1 ? <div className="confirm-warning">Uwaga: seria zawiera różne godziny. Ustawienie jednej godziny zmieni również nietypowe terminy.</div> : null}
    <div className="series-preview-list">{preview.map(({item,nextStart,nextEnd}) => <div key={item.id}><strong>{new Date(`${item.startDateTime.slice(0,10)}T12:00:00`).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'})}</strong><span>{item.startDateTime.slice(11,16)}-{item.endDateTime.slice(11,16)}</span><b>→</b><span>{nextStart.slice(11,16)}-{nextEnd.slice(11,16)}{nextStart.slice(0,10)!==item.startDateTime.slice(0,10) ? ` (${nextStart.slice(0,10)})` : ''}</span></div>)}</div>
    <footer className="modal-actions"><button type="button" className="button button-secondary" onClick={onCancel} disabled={saving}>Anuluj</button><button type="button" className="button button-primary" onClick={() => void apply()} disabled={saving || !members.length}>{saving ? 'Zapisywanie...' : `Zastosuj do ${members.length} wydarzeń`}</button></footer>
  </div>;
}
