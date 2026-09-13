import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { deleteDailyRoutineRule, getDayPlanningProfile, listDailyRoutineRules, saveDayPlanningProfile } from '../storage/database';
import type { DailyRoutineRule, DayPlanningProfile } from './planning.types';

export interface PlanningSettingsHandle {
  save: () => Promise<boolean>;
}

interface PlanningSettingsProps {
  onDataChanged: () => Promise<void>;
  hideSaveButton?: boolean;
  silentSuccess?: boolean;
}

function hoursToMinutes(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 60) : undefined;
}

function minutesToHours(value: number | undefined): string {
  return value === undefined ? '' : String(value / 60).replace('.', ',');
}

export const PlanningSettings = forwardRef<PlanningSettingsHandle, PlanningSettingsProps>(function PlanningSettings({ onDataChanged, hideSaveButton = false, silentSuccess = false }, ref) {
  const [profile, setProfile] = useState<DayPlanningProfile>();
  const [routines, setRoutines] = useState<DailyRoutineRule[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [targetHours, setTargetHours] = useState('');
  const [allowedStart, setAllowedStart] = useState('');
  const [allowedEnd, setAllowedEnd] = useState('');
  const [allowSaturday, setAllowSaturday] = useState(false);
  const [allowTradingSunday, setAllowTradingSunday] = useState(false);
  const [commuteMinutes, setCommuteMinutes] = useState('30');
  const [resetting, setResetting] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    const [loaded, loadedRoutines] = await Promise.all([getDayPlanningProfile(), listDailyRoutineRules()]);
    setProfile(loaded);
    setRoutines(loadedRoutines);
    setTargetHours(minutesToHours(loaded?.targetWeeklyWorkMinutes));
    setAllowedStart(loaded?.allowedWorkStart ?? '');
    setAllowedEnd(loaded?.allowedWorkEnd ?? '');
    setAllowSaturday(loaded?.allowSaturday ?? false);
    setAllowTradingSunday(loaded?.allowTradingSunday ?? false);
    setCommuteMinutes(String(loaded?.defaultBufferMinutes ?? 30));
  }

  const hasExtraRules = useMemo(() => Boolean(
    profile?.preferredWorkStart
    || profile?.preferredWorkEnd
    || profile?.minimumShiftMinutes !== undefined
    || profile?.maximumShiftMinutes !== undefined
    || profile?.maximumWorkDaysPerWeek !== undefined
    || profile?.maximumWorkMinutesPerDay !== undefined
    || profile?.minimumFullFreeDaysPerWeek !== undefined
    || routines.length,
  ), [profile, routines.length]);

  function buildBasicProfile() {
    const target = hoursToMinutes(targetHours);
    return {
      ...(target !== undefined ? { targetWeeklyWorkMinutes: target } : {}),
      ...(allowedStart ? { allowedWorkStart: allowedStart } : {}),
      ...(allowedEnd ? { allowedWorkEnd: allowedEnd } : {}),
      allowSaturday,
      allowTradingSunday,
      defaultBufferMinutes: Math.max(0, Math.round(Number(commuteMinutes || 0))),
    };
  }

  function validate(): boolean {
    const target = hoursToMinutes(targetHours);
    if (targetHours.trim() && (target === undefined || target <= 0)) {
      setError('Podaj prawidłowy tygodniowy cel godzin.');
      return false;
    }
    if ((allowedStart && !allowedEnd) || (!allowedStart && allowedEnd) || (allowedStart && allowedEnd && allowedEnd <= allowedStart)) {
      setError('Podaj prawidłowy zakres godzin automatu.');
      return false;
    }
    const commute = Number(commuteMinutes);
    if (!Number.isFinite(commute) || commute < 0 || commute > 180) {
      setError('Czas dojazdu musi mieścić się w zakresie 0-180 min.');
      return false;
    }
    return true;
  }

  async function save(): Promise<boolean> {
    setError('');
    setMessage('');
    if (!validate()) return false;

    try {
      await saveDayPlanningProfile({
        ...buildBasicProfile(),
        ...(profile?.preferredWorkStart ? { preferredWorkStart: profile.preferredWorkStart } : {}),
        ...(profile?.preferredWorkEnd ? { preferredWorkEnd: profile.preferredWorkEnd } : {}),
        ...(profile?.minimumShiftMinutes !== undefined ? { minimumShiftMinutes: profile.minimumShiftMinutes } : {}),
        ...(profile?.maximumShiftMinutes !== undefined ? { maximumShiftMinutes: profile.maximumShiftMinutes } : {}),
        ...(profile?.maximumWorkDaysPerWeek !== undefined ? { maximumWorkDaysPerWeek: profile.maximumWorkDaysPerWeek } : {}),
        ...(profile?.maximumWorkMinutesPerDay !== undefined ? { maximumWorkMinutesPerDay: profile.maximumWorkMinutesPerDay } : {}),
        ...(profile?.minimumFullFreeDaysPerWeek !== undefined ? { minimumFullFreeDaysPerWeek: profile.minimumFullFreeDaysPerWeek } : {}),
      });
      await refresh();
      await onDataChanged();
      if (!silentSuccess) setMessage('Zapisano ustawienia automatu.');
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać ustawień automatu.');
      return false;
    }
  }

  async function resetExtraRules() {
    const confirmed = window.confirm('Usunąć dodatkowe limity i reguły automatu? Podstawowy cel, zakres godzin i ustawienia weekendów zostaną zachowane.');
    if (!confirmed) return;
    setResetting(true);
    setError('');
    setMessage('');
    try {
      await saveDayPlanningProfile(buildBasicProfile());
      await Promise.all(routines.map((rule) => deleteDailyRoutineRule(rule.id)));
      await refresh();
      await onDataChanged();
      setMessage('Dodatkowe reguły automatu zostały wyłączone.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się wyłączyć dodatkowych reguł automatu.');
    } finally {
      setResetting(false);
    }
  }

  useImperativeHandle(ref, () => ({ save }), [targetHours, allowedStart, allowedEnd, allowSaturday, allowTradingSunday, commuteMinutes, profile, silentSuccess, onDataChanged]);

  return <div className="work-planning-settings">
    {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
    {message ? <div className="study-message success-message" role="status">{message}</div> : null}

    <section className="work-settings-section work-automation-simple">
      <div className="work-automation-simple-heading">
        <span className="section-kicker">Automatyczne propozycje</span>
        <h3>Automat</h3>
        <p className="muted-copy">Ustaw cel i zakres dnia. Resztę automat wyliczy z kalendarza, zajęć, pracy, wydarzeń i czasu dojazdu.</p>
      </div>

      <div className="form-grid three-columns work-settings-basics">
        <label className="field"><span>Cel tygodniowy <em>h</em></span><input inputMode="decimal" value={targetHours} onChange={(event) => setTargetHours(event.target.value)} placeholder="np. 20" /></label>
        <label className="field"><span>Szukaj od</span><input type="time" value={allowedStart} onChange={(event) => setAllowedStart(event.target.value)} /></label>
        <label className="field"><span>Szukaj do</span><input type="time" value={allowedEnd} onChange={(event) => setAllowedEnd(event.target.value)} /></label>
      </div>

      <div className="work-simple-options">
        <label className="field work-commute-field"><span>Dojazd <em>min</em></span><input type="number" min="0" max="180" step="5" inputMode="numeric" value={commuteMinutes} onChange={(event) => setCommuteMinutes(event.target.value)} /></label>
        <div className="work-simple-weekends">
          <label><input type="checkbox" checked={allowSaturday} onChange={(event) => setAllowSaturday(event.target.checked)} /> Sobota</label>
          <label><input type="checkbox" checked={allowTradingSunday} onChange={(event) => setAllowTradingSunday(event.target.checked)} /> Niedziela handlowa</label>
        </div>
      </div>
      <p className="work-commute-note">Dojazd jest doliczany przed i po zajęciach oraz innych wydarzeniach w innym zapisanym miejscu niż praca. Bez zewnętrznej nawigacji aplikacja używa tej jednej wartości.</p>

      {hasExtraRules ? <div className="work-extra-rules-note" role="note">
        <span>Masz zapisane dodatkowe reguły z wcześniejszej wersji.</span>
        <button type="button" className="text-button" disabled={resetting} onClick={() => void resetExtraRules()}>{resetting ? 'Wyłączanie...' : 'Wyczyść dodatkowe reguły'}</button>
      </div> : null}

      {!hideSaveButton ? <button className="button button-primary" type="button" onClick={() => void save()}>Zapisz ustawienia automatu</button> : null}
    </section>
  </div>;
});
