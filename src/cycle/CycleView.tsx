import { useEffect, useMemo, useState } from 'react';
import { createMonthGrid, formatMonthLabel, formatShortDateKey, sameMonth, toLocalDateKey } from '../calendar/date.utils';
import { Modal } from '../ui/Modal';
import {
  createCycleJournalEntry,
  createCyclePeriod,
  deleteCycleJournalEntry,
  deleteCyclePeriod,
  getLatestReversibleChange,
  listCycleJournalEntries,
  listCyclePeriods,
  setCycleGapDecision,
  undoChange,
  updateCycleJournalEntry,
  updateCyclePeriod,
} from '../storage/database';
import { buildCycleHistorySummary, cycleDaysBetween, deriveCompletedCycleLengths, predictNextPeriod } from './cycle-prediction';
import { buildCyclePatternSummary } from './cycle-patterns';
import { deriveOvulationEstimate } from './cycle-ovulation';
import type { CycleJournalEntry, CycleJournalEntryDraft, CyclePeriod, CyclePeriodDraft, PossibleMissedLog } from './cycle.types';
import { CycleJournalEditor } from './CycleJournalEditor';
import { CyclePeriodEditor } from './CyclePeriodEditor';

interface CycleViewProps {
  onProtectData: () => void;
  onDataChanged?: () => Promise<void>;
}

type CycleTab = 'today' | 'calendar' | 'history';
type CycleToastRefreshScope = 'all' | 'journal';

interface CycleToast {
  message: string;
  undoJournalId?: string;
  refreshScope?: CycleToastRefreshScope;
}

function formatPeriodRange(period: CyclePeriod): string {
  if (!period.endDate) return formatShortDateKey(period.startDate);
  const start = new Date(`${period.startDate}T12:00:00`);
  const end = new Date(`${period.endDate}T12:00:00`);
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getDate()}-${end.getDate()} ${new Intl.DateTimeFormat('pl-PL', { month: 'short' }).format(end).replace('.', '')}`;
  }
  return `${formatShortDateKey(period.startDate)} - ${formatShortDateKey(period.endDate)}`;
}

function reliabilityLabel(value: 'LOW' | 'MODERATE' | 'HIGHER'): string {
  return value === 'HIGHER' ? 'Wyższa' : value === 'MODERATE' ? 'Umiarkowana' : 'Niska';
}

function rangeLabel(window?: { startDate: string; endDate: string }): string {
  if (!window) return '';
  if (window.startDate === window.endDate) return formatShortDateKey(window.startDate);
  return `${formatShortDateKey(window.startDate)} - ${formatShortDateKey(window.endDate)}`;
}

function dateInRange(date: string, start?: string, end?: string): boolean {
  return Boolean(start && end && date >= start && date <= end);
}

function actualOnDate(period: CyclePeriod, date: string): boolean {
  return date >= period.startDate && date <= (period.endDate ?? period.startDate);
}

function bleedingLabel(value: CycleJournalEntry['bleeding']): string | undefined {
  if (value === 'NONE') return 'Brak';
  if (value === 'SPOTTING') return 'Plamienie';
  if (value === 'LIGHT') return 'Lekkie';
  if (value === 'MODERATE') return 'Umiarkowane';
  if (value === 'HEAVY') return 'Obfite';
  return undefined;
}

function painLabel(value: CycleJournalEntry['pain']): string | undefined {
  if (value === 'NONE') return 'Brak';
  if (value === 'MILD') return 'Łagodny';
  if (value === 'MODERATE') return 'Umiarkowany';
  if (value === 'STRONG') return 'Silny';
  return undefined;
}

function wellbeingLabel(value: CycleJournalEntry['wellbeing']): string | undefined {
  if (value === 'GOOD') return 'Dobre';
  if (value === 'NEUTRAL') return 'Neutralne';
  if (value === 'LOW') return 'Gorsze';
  return undefined;
}

function patternValueLabel<T extends string>(pattern: { kind: 'VALUE'; value: T } | { kind: 'MIXED' } | undefined, label: (value: T | undefined) => string | undefined): string | undefined {
  if (!pattern) return undefined;
  if (pattern.kind === 'MIXED') return 'Różnie';
  return label(pattern.value);
}

function journalSummary(entry: CycleJournalEntry): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];
  const bleeding = bleedingLabel(entry.bleeding);
  const pain = painLabel(entry.pain);
  const wellbeing = wellbeingLabel(entry.wellbeing);
  if (bleeding) items.push({ label: 'Krwawienie', value: bleeding });
  if (pain) items.push({ label: 'Ból', value: pain });
  if (entry.painMedicationTaken !== undefined) items.push({ label: 'Lek przeciwbólowy', value: entry.painMedicationTaken ? 'Tak' : 'Nie' });
  if (wellbeing) items.push({ label: 'Samopoczucie', value: wellbeing });
  if (entry.note) items.push({ label: 'Notatka', value: 'Zapisana' });
  return items;
}

export function CycleView({ onProtectData, onDataChanged }: CycleViewProps) {
  const [periods, setPeriods] = useState<CyclePeriod[]>([]);
  const [journalEntries, setJournalEntries] = useState<CycleJournalEntry[]>([]);
  const [tab, setTab] = useState<CycleTab>('today');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const [editing, setEditing] = useState<{ period?: CyclePeriod; initialStartDate?: string } | null>(null);
  const [journalEditing, setJournalEditing] = useState<{ entry?: CycleJournalEntry; initialDate: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<CycleToast | null>(null);
  const today = toLocalDateKey(new Date());

  useEffect(() => { void refreshCycleData(); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function refreshPeriods() {
    setPeriods(await listCyclePeriods());
  }

  async function refreshJournal() {
    setJournalEntries(await listCycleJournalEntries());
  }

  async function refreshCycleData() {
    const [nextPeriods, nextJournal] = await Promise.all([listCyclePeriods(), listCycleJournalEntries()]);
    setPeriods(nextPeriods);
    setJournalEntries(nextJournal);
  }

  async function showUndo(message: string, refreshScope: CycleToastRefreshScope = 'all') {
    const latest = await getLatestReversibleChange();
    setToast({ message, refreshScope, ...(latest ? { undoJournalId: latest.id } : {}) });
  }

  async function runPeriod(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    try {
      await action();
      await refreshPeriods();
      if (onDataChanged) await onDataChanged();
      await showUndo(success, 'all');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać zmiany.');
    } finally {
      setBusy(false);
    }
  }

  const prediction = useMemo(() => predictNextPeriod(periods, today), [periods, today]);
  const ovulationEstimate = useMemo(() => deriveOvulationEstimate(prediction), [prediction]);
  const summary = useMemo(() => buildCycleHistorySummary(periods), [periods]);
  const patternSummary = useMemo(() => buildCyclePatternSummary(periods, journalEntries), [periods, journalEntries]);
  const completed = useMemo(() => deriveCompletedCycleLengths(periods), [periods]);
  const latest = periods[periods.length - 1];
  const cycleDay = latest && latest.startDate <= today ? cycleDaysBetween(latest.startDate, today) + 1 : undefined;
  const grid = useMemo(() => createMonthGrid(month), [month]);
  const completedByFrom = useMemo(() => new Map(completed.completed.map((item) => [item.fromPeriodId, item.lengthDays])), [completed]);
  const journalByDate = useMemo(() => new Map(journalEntries.map((entry) => [entry.date, entry])), [journalEntries]);
  const todayJournal = journalByDate.get(today);
  const selectedJournal = journalByDate.get(selectedDate);
  const patternBleeding = patternValueLabel(patternSummary.bleeding, bleedingLabel);
  const patternPain = patternValueLabel(patternSummary.pain, painLabel);
  const patternWellbeing = patternValueLabel(patternSummary.wellbeing, wellbeingLabel);
  const hasCyclePatterns = patternSummary.typicalPeriodDurationDays !== undefined || Boolean(patternBleeding || patternPain || patternWellbeing);
  const pendingMissed = prediction.diagnostics.possibleMissedLogs[0];

  async function quickStartToday() {
    if (periods.some((period) => period.startDate === today)) {
      const existing = periods.find((period) => period.startDate === today)!;
      setEditing({ period: existing });
      return;
    }
    await runPeriod(async () => { await createCyclePeriod({ startDate: today }); }, 'Zapisano początek miesiączki.');
  }

  async function saveEditor(draft: CyclePeriodDraft) {
    const current = editing?.period;
    if (current) await updateCyclePeriod(current.id, draft);
    else await createCyclePeriod(draft);
    setEditing(null);
    await refreshPeriods();
    if (onDataChanged) await onDataChanged();
    await showUndo(current ? 'Historia została zaktualizowana.' : 'Dodano miesiączkę do historii.', 'all');
  }

  async function removeEditor() {
    if (!editing?.period) return;
    await deleteCyclePeriod(editing.period.id);
    setEditing(null);
    await refreshPeriods();
    if (onDataChanged) await onDataChanged();
    await showUndo('Usunięto wpis z historii cyklu.', 'all');
  }

  function openJournalEditor(date: string) {
    if (date > today) return;
    const entry = journalByDate.get(date);
    setJournalEditing({ initialDate: date, ...(entry ? { entry } : {}) });
  }

  async function saveJournalEditor(draft: CycleJournalEntryDraft) {
    const current = journalEditing?.entry;
    if (current) await updateCycleJournalEntry(current.id, draft);
    else await createCycleJournalEntry(draft);
    setJournalEditing(null);
    await refreshJournal();
    await showUndo(current ? 'Zaktualizowano wpis dnia.' : 'Dodano wpis dnia.', 'journal');
  }

  async function removeJournalEditor() {
    if (!journalEditing?.entry) return;
    await deleteCycleJournalEntry(journalEditing.entry.id);
    setJournalEditing(null);
    await refreshJournal();
    await showUndo('Usunięto wpis dnia.', 'journal');
  }

  async function saveEndToday() {
    if (!latest) return;
    await runPeriod(async () => {
      await updateCyclePeriod(latest.id, { startDate: latest.startDate, endDate: today, ...(latest.isUserMarkedAtypical ? { isUserMarkedAtypical: true } : {}) });
    }, 'Zapisano koniec miesiączki.');
  }

  async function resolveGap(gap: PossibleMissedLog, decision: 'CONFIRMED_SINGLE_CYCLE' | 'OBSERVATION_BREAK') {
    await runPeriod(() => setCycleGapDecision(gap.toPeriodId, decision).then(() => undefined), decision === 'OBSERVATION_BREAK' ? 'Pominięto tę przerwę w nauce modelu.' : 'Potwierdzono rzeczywisty długi cykl.');
  }

  async function undoLatest(id: string, refreshScope: CycleToastRefreshScope = 'all') {
    try {
      await undoChange(id);
      if (refreshScope === 'journal') {
        await refreshJournal();
      } else {
        await refreshCycleData();
        if (onDataChanged) await onDataChanged();
      }
      setToast({ message: 'Cofnięto zmianę.' });
    } catch (cause) {
      setToast({ message: cause instanceof Error ? cause.message : 'Nie udało się cofnąć zmiany.' });
    }
  }

  function predictionCopy() {
    if (prediction.reason === 'POSSIBLE_MISSED_LOG') return { title: 'Najpierw sprawdź lukę w historii', copy: 'Nietypowo długa przerwa może oznaczać brakujący wpis albo przerwę w prowadzeniu obserwacji.' };
    if (prediction.status === 'UNAVAILABLE') return { title: 'Za mało danych do prognozy', copy: summary.completedCycleCount ? 'Masz zapisany pierwszy pełny cykl. Potrzeba kolejnych obserwacji, aby uczciwie oszacować następny.' : 'Zapisz początek kolejnej miesiączki, aby poznać długość pierwszego pełnego cyklu.' };
    if (prediction.status === 'EXPIRED') return { title: 'Przewidywane okno minęło', copy: 'Jeśli miesiączka już się rozpoczęła, zapisz jej początek. Jeśli nie, obecny szacunek jest już bardzo niepewny.' };
    if (prediction.status === 'UNRELIABLE') return { title: 'Szacunek jest teraz bardzo niepewny', copy: 'Ostatnie cykle bardziej różniły się długością. Nie chcemy podawać pozornie dokładnej daty.' };
    if (prediction.status === 'PRELIMINARY') return { title: 'Wstępny szacunek', copy: 'Historia jest jeszcze krótka, dlatego zakres pozostaje szeroki i ostrożny.' };
    return { title: 'Następna miesiączka', copy: prediction.diagnostics.regimeState === 'POSSIBLE_SHIFT' ? 'Kilka ostatnich cykli zaczęło różnić się od wcześniejszych, dlatego model mocniej uwzględnia najnowsze dane.' : 'Szacunek jest wyliczany wyłącznie z zapisanej przez Ciebie historii.' };
  }

  const copy = predictionCopy();

  return (
    <section className="view-shell cycle-view">
      <header className="view-header cycle-header">
        <div><p className="eyebrow">Zdrowie i własna historia</p><h1>Cykl</h1><p className="view-subtitle">Spokojny kalendarz, który poznaje Twój własny wzorzec i pokazuje niepewność zamiast udawać pewność.</p></div>
      </header>

      <div className="cycle-tabs" role="tablist" aria-label="Widoki modułu Cykl">
        <button type="button" role="tab" aria-selected={tab === 'today'} className={tab === 'today' ? 'filter-button active' : 'filter-button'} onClick={() => setTab('today')}>Dzisiaj</button>
        <button type="button" role="tab" aria-selected={tab === 'calendar'} className={tab === 'calendar' ? 'filter-button active' : 'filter-button'} onClick={() => setTab('calendar')}>Kalendarz</button>
        <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'filter-button active' : 'filter-button'} onClick={() => setTab('history')}>Historia</button>
      </div>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}

      {tab === 'today' ? (
        <div className="cycle-today-stack">
          {!periods.length ? (
            <section className="panel cycle-empty">
              <p className="section-kicker">Cykl</p><h2>Zacznij prowadzić swój cykl</h2><p>Zapisz pierwszy dzień miesiączki. Możesz zacząć od dzisiaj albo później dodać wcześniejsze daty.</p>
              <div className="cycle-empty-actions"><button type="button" className="button button-primary" disabled={busy} onClick={() => void quickStartToday()}>Zapisz początek miesiączki</button><button type="button" className="button button-secondary" onClick={() => setEditing({})}>Dodaj wcześniejszą miesiączkę</button></div>
            </section>
          ) : (
            <section className="panel cycle-today-card">
              <div className="cycle-now"><span>Dzisiaj</span>{cycleDay ? <strong>Dzień {cycleDay} cyklu</strong> : <strong>Historia rozpoczęta</strong>}</div>
              <div className="cycle-last"><span>Ostatnia miesiączka</span><strong>{latest ? formatPeriodRange(latest) : '-'}</strong>{latest && !latest.endDate ? <small>Koniec nieuzupełniony</small> : null}</div>
              {latest && !latest.endDate ? <button type="button" className="text-button" disabled={busy || today < latest.startDate} onClick={() => void saveEndToday()}>Zapisz koniec jako dzisiaj</button> : null}
            </section>
          )}

          <section className="panel cycle-journal-card" aria-labelledby="cycle-journal-today-title">
            <div className="cycle-journal-card-heading"><div><p className="section-kicker">Dziennik dnia</p><h2 id="cycle-journal-today-title">Twoje obserwacje na dziś</h2></div><button type="button" className={todayJournal ? 'button button-secondary button-small' : 'button button-primary button-small'} onClick={() => openJournalEditor(today)}>{todayJournal ? 'Edytuj wpis' : 'Dodaj wpis'}</button></div>
            {todayJournal ? <div className="cycle-journal-summary">{journalSummary(todayJournal).map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div> : <p className="muted-copy">Nie masz jeszcze obserwacji na dziś.</p>}
            <p className="cycle-journal-boundary">Dziennik zapisuje Twoje obserwacje. Nie diagnozuje i nie ocenia ich medycznie.</p>
          </section>

          {periods.length ? (
            <>
              <section className="panel cycle-prediction-card">
                <p className="section-kicker">Szacunek</p><h2>{copy.title}</h2><p className="cycle-prediction-copy">{copy.copy}</p>
                {prediction.primaryWindow && prediction.status !== 'UNRELIABLE' && prediction.status !== 'EXPIRED' ? <div className="cycle-window primary"><span>Najbardziej prawdopodobnie</span><strong>{rangeLabel(prediction.primaryWindow)}</strong></div> : null}
                {prediction.wideWindow ? <div className="cycle-window"><span>Szerszy możliwy zakres</span><strong>{rangeLabel(prediction.wideWindow)}</strong></div> : null}
                {prediction.status !== 'UNAVAILABLE' ? <div className="cycle-reliability"><span>Wiarygodność szacunku</span><strong>{reliabilityLabel(prediction.reliability)}</strong></div> : null}
                {ovulationEstimate.status === 'READY' && ovulationEstimate.window ? <div className="cycle-ovulation-estimate"><span>Możliwe okno owulacji</span><strong>{rangeLabel(ovulationEstimate.window)}</strong><small>To tylko szacunek kalendarzowy. Nie potwierdza owulacji i nie służy do wyznaczania bezpiecznych dni ani jako metoda antykoncepcji.</small></div> : prediction.status === 'PRELIMINARY' || (prediction.status === 'READY' && prediction.reliability === 'LOW') ? <div className="cycle-ovulation-estimate unavailable"><span>Możliwe okno owulacji</span><small>Okno pojawi się dopiero przy stabilniejszej historii cyklu.</small></div> : null}
                <details className="cycle-why"><summary>Dlaczego taki zakres?</summary><p>Model korzysta z {prediction.diagnostics.completedCycleCount} pełnych cykli. {prediction.diagnostics.completedCyclesSinceLastObservationBreak !== undefined && prediction.diagnostics.completedCyclesSinceLastObservationBreak < 2 ? 'Po ostatniej przerwie w obserwacji mamy jeszcze mało nowych pełnych cykli, dlatego wiarygodność pozostaje niska. ' : prediction.diagnostics.regimeState === 'POSSIBLE_SHIFT' ? 'Kilka ostatnich cykli zaczęło różnić się od wcześniejszych. ' : prediction.diagnostics.regimeState === 'ELEVATED_UNCERTAINTY' ? 'Ostatni cykl wyraźnie różnił się od wcześniejszych. ' : ''}Każdy kolejny cykl daje więcej informacji, ale większa zmienność może utrzymać szeroki zakres.</p></details>
                <div className="cycle-primary-actions"><button type="button" className="button button-primary" disabled={busy} onClick={() => void quickStartToday()}>Zapisz początek miesiączki</button><button type="button" className="button button-secondary" onClick={() => setEditing({})}>Wybierz inną datę</button></div>
              </section>

              {pendingMissed ? (
                <section className="panel cycle-gap-card" aria-labelledby="cycle-gap-title">
                  <p className="section-kicker">Sprawdź historię</p><h2 id="cycle-gap-title">Między dwiema datami jest nietypowo długa przerwa</h2><p>Możliwe, że brakuje wpisu albo że w tym czasie nie prowadziłaś pełnej historii. Model nie będzie zgadywał.</p>
                  <div className="cycle-gap-dates"><span>{formatShortDateKey(pendingMissed.startDate)}</span><i aria-hidden="true" /><span>{formatShortDateKey(pendingMissed.nextStartDate)}</span><strong>{pendingMissed.gapDays} dni</strong></div>
                  <div className="cycle-gap-actions"><button type="button" className="button button-primary" onClick={() => setEditing({})} disabled={busy}>Dodaj brakującą miesiączkę</button><button type="button" className="button button-secondary" onClick={() => void resolveGap(pendingMissed, 'CONFIRMED_SINGLE_CYCLE')} disabled={busy}>To był jeden rzeczywisty cykl</button><button type="button" className="text-button" onClick={() => void resolveGap(pendingMissed, 'OBSERVATION_BREAK')} disabled={busy}>Pomiń ten odstęp w nauce modelu</button></div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'calendar' ? (
        <section className="panel cycle-calendar-panel">
          <div className="calendar-toolbar"><button type="button" className="icon-button soft" aria-label="Poprzedni miesiąc" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><h2>{formatMonthLabel(month)}</h2><button type="button" className="icon-button soft" aria-label="Następny miesiąc" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
          <div className="cycle-legend"><span><i className="cycle-dot actual" />Zapisane</span><span><i className="cycle-dot predicted" />Przewidywane</span><span><i className="cycle-dot wide" />Szerszy zakres</span><span><i className="cycle-dot journal" />Dziennik</span></div>
          <div className="calendar-weekdays" aria-hidden="true"><span>Pn</span><span>Wt</span><span>Śr</span><span>Cz</span><span>Pt</span><span>So</span><span>Nd</span></div>
          <div className="calendar-grid cycle-calendar-grid">
            {grid.map((date) => {
              const key = toLocalDateKey(date);
              const actual = periods.some((period) => actualOnDate(period, key));
              const primary = dateInRange(key, prediction.primaryWindow?.startDate, prediction.primaryWindow?.endDate);
              const wide = !primary && dateInRange(key, prediction.wideWindow?.startDate, prediction.wideWindow?.endDate);
              const hasJournal = journalByDate.has(key);
              const classes = ['calendar-day', 'cycle-day', !sameMonth(date, month) ? 'muted' : '', key === today ? 'today' : '', key === selectedDate ? 'selected' : '', actual ? 'cycle-actual' : primary ? 'cycle-predicted' : wide ? 'cycle-wide' : '', hasJournal ? 'has-cycle-journal' : ''].filter(Boolean).join(' ');
              const state = actual ? 'zapisana miesiączka' : primary ? 'główne przewidywane okno' : wide ? 'szerszy przewidywany zakres' : 'bez oznaczenia';
              const journalState = hasJournal ? ', wpis dziennika' : '';
              return <button type="button" key={key} className={classes} onClick={() => setSelectedDate(key)} aria-label={`${formatShortDateKey(key)}, ${state}${journalState}`}><span className="day-number">{date.getDate()}</span><span className="cycle-day-markers" aria-hidden="true">{actual || primary || wide ? <span className="cycle-day-marker">{actual ? '●' : primary ? '○' : '·'}</span> : null}{hasJournal ? <span className="cycle-journal-marker" /> : null}</span></button>;
            })}
          </div>
          <div className="cycle-selected-day">
            <strong>{new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${selectedDate}T12:00:00`))}</strong>
            {periods.some((period) => actualOnDate(period, selectedDate)) ? <span>Zapisana miesiączka</span> : dateInRange(selectedDate, prediction.primaryWindow?.startDate, prediction.primaryWindow?.endDate) ? <span>Przewidywany możliwy początek - szacunek na podstawie Twojej historii</span> : dateInRange(selectedDate, prediction.wideWindow?.startDate, prediction.wideWindow?.endDate) ? <span>Szerszy możliwy zakres prognozy</span> : <span>Brak wpisu w historii miesiączek</span>}
            <div className="cycle-selected-journal">
              <div><span>Dziennik dnia</span>{selectedJournal ? <div className="cycle-journal-inline-summary">{journalSummary(selectedJournal).map((item) => <span key={item.label}><strong>{item.label}:</strong> {item.value}</span>)}</div> : <small>{selectedDate <= today ? 'Brak obserwacji w dzienniku.' : 'Dziennik służy do zapisywania rzeczywistych obserwacji.'}</small>}</div>
              {selectedDate <= today ? <button type="button" className="button button-secondary button-small" onClick={() => openJournalEditor(selectedDate)}>{selectedJournal ? 'Edytuj wpis' : 'Dodaj wpis dnia'}</button> : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === 'history' ? (
        <div className="cycle-history-stack">
          <section className="panel cycle-history-panel">
            <div className="cycle-history-heading"><div><p className="section-kicker">Historia</p><h2>{periods.length ? `${periods.length} zapisanych miesiączek` : 'Historia jest pusta'}</h2></div><button type="button" className="button button-primary button-small" onClick={() => setEditing({})}>Dodaj miesiączkę</button></div>
            {periods.length ? <div className="cycle-history-list">{[...periods].reverse().map((period) => {
              const cycleLength = completedByFrom.get(period.id);
              return <button type="button" className="cycle-history-row" key={period.id} onClick={() => setEditing({ period })}><span><strong>{formatPeriodRange(period)}</strong>{period.endDate ? null : <small>Koniec nieuzupełniony</small>}{period.isUserMarkedAtypical ? <small>Oznaczony jako nietypowy</small> : null}{period.previousGapDecision === 'OBSERVATION_BREAK' ? <small>Przerwa w obserwacji przed tym wpisem</small> : null}</span><span>{cycleLength ? `${cycleLength} dni` : 'Edytuj'}</span></button>;
            })}</div> : <p className="muted-copy">Dodaj pierwszy rzeczywisty początek miesiączki.</p>}
          </section>
          {(periods.length || journalEntries.length) ? <section className="panel cycle-history-summary">
            {summary.completedCycleCount ? <><p className="section-kicker">Twój cykl</p><div className="cycle-summary-grid"><div><span>Pełne cykle</span><strong>{summary.completedCycleCount}</strong></div>{summary.typicalLabel ? <div><span>Typowo</span><strong>{summary.typicalLabel}</strong></div> : null}{summary.observedRangeLabel ? <div><span>Zaobserwowany zakres</span><strong>{summary.observedRangeLabel}</strong></div> : null}</div>{summary.variable ? <p>Ostatnie dane są bardziej zmienne, dlatego model pozostaje ostrożny.</p> : null}</> : null}
            <div className={summary.completedCycleCount ? 'cycle-patterns with-divider' : 'cycle-patterns'}>
              <p className="section-kicker">Własne wzorce</p>
              {patternSummary.completedPeriodCount || patternSummary.matchedJournalEntryCount ? <p className="cycle-patterns-basis">Dane: zakończone miesiączki - {patternSummary.completedPeriodCount}, wpisy dziennika z ich dni - {patternSummary.matchedJournalEntryCount}.</p> : null}
              {hasCyclePatterns ? <div className="cycle-pattern-list">
                {patternSummary.typicalPeriodDurationDays !== undefined ? <div className="cycle-pattern-row"><span>Typowa długość miesiączki</span><strong>{patternSummary.typicalPeriodDurationDays} dni</strong></div> : null}
                {patternBleeding ? <div className="cycle-pattern-row"><span>Krwawienie</span><strong>{patternBleeding === 'Różnie' ? patternBleeding : `Najczęściej ${patternBleeding.toLocaleLowerCase('pl-PL')}`}</strong></div> : null}
                {patternPain ? <div className="cycle-pattern-row"><span>Ból</span><strong>{patternPain === 'Różnie' ? patternPain : `Najczęściej ${patternPain.toLocaleLowerCase('pl-PL')}`}</strong></div> : null}
                {patternWellbeing ? <div className="cycle-pattern-row"><span>Samopoczucie</span><strong>{patternWellbeing === 'Różnie' ? patternWellbeing : `Najczęściej ${patternWellbeing.toLocaleLowerCase('pl-PL')}`}</strong></div> : null}
              </div> : <p className="muted-copy cycle-patterns-empty">Za mało danych, aby pokazać wzorce. Zapisuj dalej miesiączki i obserwacje dnia.</p>}
              <p className="cycle-patterns-boundary">To opis Twoich zapisów, nie ocena medyczna.</p>
            </div>
            {summary.completedCycleCount >= 3 ? <div className="cycle-protection"><span>Historia jest zapisana lokalnie. Dla dodatkowego bezpieczeństwa możesz zachować kopię poza przeglądarką.</span><button type="button" className="button button-secondary button-small" onClick={onProtectData}>Zabezpiecz dane</button></div> : null}
          </section> : null}
        </div>
      ) : null}

      {editing ? <Modal title={editing.period ? 'Edytuj miesiączkę' : 'Dodaj miesiączkę'} onClose={() => setEditing(null)}><CyclePeriodEditor {...(editing.period ? { period: editing.period, onDelete: removeEditor } : {})} {...(editing.initialStartDate ? { initialStartDate: editing.initialStartDate } : {})} onSave={saveEditor} onCancel={() => setEditing(null)} /></Modal> : null}
      {journalEditing ? <Modal title={journalEditing.entry ? 'Edytuj wpis dziennika' : 'Dodaj wpis dziennika'} onClose={() => setJournalEditing(null)}><CycleJournalEditor {...(journalEditing.entry ? { entry: journalEditing.entry, onDelete: removeJournalEditor } : {})} initialDate={journalEditing.initialDate} onSave={saveJournalEditor} onCancel={() => setJournalEditing(null)} /></Modal> : null}
      {toast ? <div className="toast toast-with-action" role="status"><span>{toast.message}</span>{toast.undoJournalId ? <button type="button" onClick={() => void undoLatest(toast.undoJournalId!, toast.refreshScope ?? 'all')}>Cofnij</button> : null}</div> : null}
    </section>
  );
}
