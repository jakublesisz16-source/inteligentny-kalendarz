import { useEffect, useState } from 'react';
import { deleteDailyRoutineRule, getDayPlanningProfile, listDailyRoutineRules, saveDailyRoutineRule, saveDayPlanningProfile } from '../storage/database';
import type { DailyRoutineRule, DayPlanningProfile, RoutinePriority, RoutineRuleType } from './planning.types';

interface PlanningSettingsProps { onDataChanged: () => Promise<void>; }
const weekdays = [{ value: 1, label: 'Pon' }, { value: 2, label: 'Wt' }, { value: 3, label: 'Śr' }, { value: 4, label: 'Czw' }, { value: 5, label: 'Pt' }, { value: 6, label: 'Sob' }, { value: 0, label: 'Niedz' }];

function hoursToMinutes(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 60) : undefined;
}
function minutesToHours(value: number | undefined): string { return value === undefined ? '' : String(value / 60).replace('.', ','); }

export function PlanningSettings({ onDataChanged }: PlanningSettingsProps) {
  const [profile, setProfile] = useState<DayPlanningProfile | undefined>(undefined);
  const [routines, setRoutines] = useState<DailyRoutineRule[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [targetHours, setTargetHours] = useState('');
  const [allowedStart, setAllowedStart] = useState('');
  const [allowedEnd, setAllowedEnd] = useState('');
  const [minimumShift, setMinimumShift] = useState('');
  const [maximumShift, setMaximumShift] = useState('');
  const [maximumDaily, setMaximumDaily] = useState('');
  const [preferredStart, setPreferredStart] = useState('');
  const [preferredEnd, setPreferredEnd] = useState('');
  const [maxDays, setMaxDays] = useState('');
  const [minFreeDays, setMinFreeDays] = useState('');
  const [buffer, setBuffer] = useState('');
  const [allowSaturday, setAllowSaturday] = useState(false);
  const [allowTradingSunday, setAllowTradingSunday] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [routinesOpen, setRoutinesOpen] = useState(false);

  const [routineName, setRoutineName] = useState('');
  const [routineType, setRoutineType] = useState<RoutineRuleType>('FLEXIBLE');
  const [routinePriority, setRoutinePriority] = useState<RoutinePriority>('REQUIRED');
  const [routineMinutes, setRoutineMinutes] = useState('60');
  const [routineDays, setRoutineDays] = useState<number[]>([]);
  const [fixedStart, setFixedStart] = useState('');
  const [fixedEnd, setFixedEnd] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');

  useEffect(() => { void refresh(); }, []);
  async function refresh() {
    const [loaded, loadedRoutines] = await Promise.all([getDayPlanningProfile(), listDailyRoutineRules()]);
    setProfile(loaded);
    setRoutines(loadedRoutines);
    setTargetHours(minutesToHours(loaded?.targetWeeklyWorkMinutes));
    setAllowedStart(loaded?.allowedWorkStart ?? '');
    setAllowedEnd(loaded?.allowedWorkEnd ?? '');
    setMinimumShift(minutesToHours(loaded?.minimumShiftMinutes));
    setMaximumShift(minutesToHours(loaded?.maximumShiftMinutes));
    setMaximumDaily(minutesToHours(loaded?.maximumWorkMinutesPerDay));
    setPreferredStart(loaded?.preferredWorkStart ?? '');
    setPreferredEnd(loaded?.preferredWorkEnd ?? '');
    setMaxDays(loaded?.maximumWorkDaysPerWeek === undefined ? '' : String(loaded.maximumWorkDaysPerWeek));
    setMinFreeDays(loaded?.minimumFullFreeDaysPerWeek === undefined ? '' : String(loaded.minimumFullFreeDaysPerWeek));
    setBuffer(loaded?.defaultBufferMinutes === undefined ? '' : String(loaded.defaultBufferMinutes));
    setAllowSaturday(loaded?.allowSaturday ?? false);
    setAllowTradingSunday(loaded?.allowTradingSunday ?? false);
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const target = hoursToMinutes(targetHours);
    const minShift = hoursToMinutes(minimumShift);
    const maxShift = hoursToMinutes(maximumShift);
    const maxDaily = hoursToMinutes(maximumDaily);
    if (targetHours.trim() && (target === undefined || target <= 0)) { setError('Podaj prawidłowy tygodniowy cel godzin.'); return; }
    if ((allowedStart && !allowedEnd) || (!allowedStart && allowedEnd) || (allowedStart && allowedEnd && allowedEnd <= allowedStart)) { setError('Podaj prawidłowe standardowe ramy pracy.'); return; }
    try {
      await saveDayPlanningProfile({
        ...(target !== undefined ? { targetWeeklyWorkMinutes: target } : {}),
        ...(allowedStart ? { allowedWorkStart: allowedStart } : {}),
        ...(allowedEnd ? { allowedWorkEnd: allowedEnd } : {}),
        ...(preferredStart ? { preferredWorkStart: preferredStart } : {}),
        ...(preferredEnd ? { preferredWorkEnd: preferredEnd } : {}),
        ...(minShift !== undefined ? { minimumShiftMinutes: minShift } : {}),
        ...(maxShift !== undefined ? { maximumShiftMinutes: maxShift } : {}),
        ...(maxDaily !== undefined ? { maximumWorkMinutesPerDay: maxDaily } : {}),
        ...(maxDays ? { maximumWorkDaysPerWeek: Number(maxDays) } : {}),
        ...(minFreeDays ? { minimumFullFreeDaysPerWeek: Number(minFreeDays) } : {}),
        ...(buffer ? { defaultBufferMinutes: Number(buffer) } : {}),
        allowSaturday,
        allowTradingSunday,
      });
      await refresh(); await onDataChanged(); setMessage('Zapisano ustawienia dyspozycyjności.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać ustawień.'); }
  }

  function toggleRoutineDay(day: number) { setRoutineDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day]); }
  async function addRoutine(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (!routineName.trim()) { setError('Nadaj nazwę ograniczeniu.'); return; }
    try {
      const timeToMinutes = (value: string) => { const [h, m] = value.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
      const fixedDuration = routineType === 'FIXED' && fixedStart && fixedEnd ? ((timeToMinutes(fixedEnd) - timeToMinutes(fixedStart) + 1440) % 1440 || 1440) : undefined;
      const minutes = fixedDuration ?? Number(routineMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0) { setError('Podaj prawidłowy czas ograniczenia.'); return; }
      await saveDailyRoutineRule({
        name: routineName.trim(), type: routineType, daysOfWeek: routineDays, durationMinutes: minutes,
        ...(routineType === 'FIXED' ? { fixedStart, fixedEnd } : {}),
        ...(routineType === 'FLEXIBLE' && windowStart ? { preferredWindowStart: windowStart } : {}),
        ...(routineType === 'FLEXIBLE' && windowEnd ? { preferredWindowEnd: windowEnd } : {}),
        priority: routinePriority, active: true,
      });
      setRoutineName(''); setRoutineDays([]); await refresh(); await onDataChanged(); setMessage('Dodano ograniczenie.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się dodać ograniczenia.'); }
  }

  async function removeRoutine(id: string) { await deleteDailyRoutineRule(id); await refresh(); await onDataChanged(); }

  return <div className="work-planning-settings">
    {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
    {message ? <div className="study-message success-message" role="status">{message}</div> : null}
    <form className="work-planning-form" onSubmit={saveProfile}>
      <div className="work-settings-section">
        <div><span className="section-kicker">Dyspozycyjność</span><h3>Podstawy</h3><p className="muted-copy">Nie ustawiasz godzin dla każdego dnia. Standardowe ramy są jednorazową granicą, a zajęcia i wydarzenia zawężają je automatycznie.</p></div>
        <div className="form-grid three-columns work-settings-basics">
          <label className="field"><span>Cel tygodniowy <em>h</em></span><input inputMode="decimal" value={targetHours} onChange={(e) => setTargetHours(e.target.value)} placeholder="np. 24" /></label>
          <label className="field"><span>Standardowo od</span><input type="time" value={allowedStart} onChange={(e) => setAllowedStart(e.target.value)} /></label>
          <label className="field"><span>Standardowo do</span><input type="time" value={allowedEnd} onChange={(e) => setAllowedEnd(e.target.value)} /></label>
        </div>
        <div className="availability-toggle-row"><label><input type="checkbox" checked={allowSaturday} onChange={(e) => setAllowSaturday(e.target.checked)} /> Sobota</label><label><input type="checkbox" checked={allowTradingSunday} onChange={(e) => setAllowTradingSunday(e.target.checked)} /> Niedziele handlowe</label></div>
      </div>

      <details className="work-settings-details" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
        <summary aria-expanded={advancedOpen}>Zaawansowane</summary>
        <div className="work-settings-details-body">
          <div className="form-grid three-columns">
            <label className="field"><span>Minimum zmiany <em>h</em></span><input inputMode="decimal" value={minimumShift} onChange={(e) => setMinimumShift(e.target.value)} placeholder="brak" /></label>
            <label className="field"><span>Maksimum zmiany <em>h</em></span><input inputMode="decimal" value={maximumShift} onChange={(e) => setMaximumShift(e.target.value)} placeholder="brak" /></label>
            <label className="field"><span>Maks. godzin dziennie <em>h</em></span><input inputMode="decimal" value={maximumDaily} onChange={(e) => setMaximumDaily(e.target.value)} placeholder="brak" /></label>
          </div>
          <div className="form-grid two-columns">
            <label className="field"><span>Maks. dni pracy</span><input type="number" min="1" max="7" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} placeholder="brak" /></label>
            <label className="field"><span>Bufor bezpieczeństwa <em>min</em></span><input type="number" min="0" value={buffer} onChange={(e) => setBuffer(e.target.value)} placeholder="0" /></label>
          </div>
          <div className="form-grid two-columns">
            <label className="field"><span>Preferuję pracę od</span><input type="time" value={preferredStart} onChange={(e) => setPreferredStart(e.target.value)} /></label>
            <label className="field"><span>Preferuję pracę do</span><input type="time" value={preferredEnd} onChange={(e) => setPreferredEnd(e.target.value)} /></label>
          </div>

        </div>
      </details>
      <button className="button button-primary" type="submit">Zapisz</button>
    </form>
    <details className="work-settings-details work-routines-details" open={routinesOpen} onToggle={(event) => setRoutinesOpen(event.currentTarget.open)}>
      <summary aria-expanded={routinesOpen}>Dodatkowe ograniczenia{routines.length ? ` (${routines.length})` : ''}</summary>
      <div className="work-settings-details-body">
        {routines.length ? <div className="routine-list minimal-routine-list">{routines.map((rule) => <article key={rule.id} className="routine-card"><div><strong>{rule.name}</strong><span>{rule.type === 'FIXED' ? `${rule.fixedStart}-${rule.fixedEnd}` : `Potrzebuję ${rule.durationMinutes >= 60 && rule.durationMinutes % 60 === 0 ? `${rule.durationMinutes / 60} h` : `${rule.durationMinutes} min`}`}</span><small>{rule.priority === 'REQUIRED' ? 'Musi być uwzględnione' : 'Jeśli się da'} · {rule.daysOfWeek.length ? rule.daysOfWeek.map((day) => weekdays.find((item) => item.value === day)?.label).join(', ') : 'codziennie'}</small></div><button className="text-button danger-text" type="button" onClick={() => void removeRoutine(rule.id)}>Usuń</button></article>)}</div> : <p className="muted-copy">Brak dodatkowych ograniczeń.</p>}
        <form className="routine-create-form minimal-routine-form" onSubmit={addRoutine}>
          <div className="form-grid two-columns"><label className="field"><span>Nazwa</span><input value={routineName} onChange={(e) => setRoutineName(e.target.value)} placeholder="np. Nauka" /></label><label className="field"><span>Jak działa?</span><select value={routineType} onChange={(e) => setRoutineType(e.target.value as RoutineRuleType)}><option value="FLEXIBLE">Potrzebuję czasu</option><option value="FIXED">Stała pora</option></select></label></div>
          {routineType === 'FIXED' ? <div className="form-grid two-columns"><label className="field"><span>Od</span><input type="time" value={fixedStart} onChange={(e) => setFixedStart(e.target.value)} /></label><label className="field"><span>Do</span><input type="time" value={fixedEnd} onChange={(e) => setFixedEnd(e.target.value)} /></label></div> : <div className="form-grid three-columns"><label className="field"><span>Ile czasu <em>min</em></span><input type="number" min="1" value={routineMinutes} onChange={(e) => setRoutineMinutes(e.target.value)} /></label><label className="field"><span>Najlepiej od</span><input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} /></label><label className="field"><span>Najlepiej do</span><input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} /></label></div>}
          <div className="weekday-picker" aria-label="Dni tygodnia">{weekdays.map((day) => <label key={day.value} className={routineDays.includes(day.value) ? 'selected' : ''}><input type="checkbox" checked={routineDays.includes(day.value)} onChange={() => toggleRoutineDay(day.value)} /><span>{day.label}</span></label>)}</div>
          <button className="button button-secondary button-small" type="submit">Dodaj ograniczenie</button>
        </form>
      </div>
    </details>
  </div>;
}
