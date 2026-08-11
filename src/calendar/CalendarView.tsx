import { useEffect, useMemo, useState } from 'react';
import {
  createMonthGrid,
  eventOccursOnDate,
  formatMonthLabel,
  sameMonth,
  sortEventsForDay,
  toLocalDateKey,
} from './date.utils';
import { categoryCountsByDate } from './category-counters';
import type { CalendarEvent } from '../events/event.types';
import type { Location } from '../locations/location.types';
import type { TimeFormat } from '../settings/settings.types';
import type { DayConstraint } from '../safety/safety.types';
import type { CalendarConsistencyIssue, DayAttribute } from '../planning/planning.types';
import { ConsistencyCenter } from '../planning/ConsistencyCenter';
import { EventCard } from '../events/EventCard';
import { EmptyState } from '../ui/EmptyState';
import type { AvailabilityPlan } from '../availability/availability.types';
import { ruleLabel } from '../availability/availability-day-rules';
import type { CoworkerOverlap } from '../work/work.types';

interface CalendarViewProps {
  events: CalendarEvent[];
  locations: Location[];
  timeFormat: TimeFormat;
  dayConstraints: DayConstraint[];
  dayAttributes: DayAttribute[];
  consistencyIssues: CalendarConsistencyIssue[];
  onToggleWorkAvailabilityExclusion: (date: string, excluded: boolean) => Promise<void>;
  onToggleTradingSunday: (date: string, active: boolean) => Promise<void>;
  onAcknowledgeConsistency: (issue: CalendarConsistencyIssue) => Promise<void>;
  onAdd: (date?: Date) => void;
  onAddMany: (dateKeys: string[]) => void;
  onEdit: (event: CalendarEvent) => void;
  onStudyCorrect?: (event: CalendarEvent) => void;
  onStudySeriesCorrect: (event: CalendarEvent) => void;
  availabilityPlans?: AvailabilityPlan[];
  coworkersByEvent?: Record<string, CoworkerOverlap[]>;
  onOpenAvailability: (date: string, blockId?: string) => void;
}

const weekdayLabels = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];
const categoryLabels = { STUDY: 'Zajęcia', WORK: 'Praca', PERSONAL: 'Prywatne', OTHER: 'Inne' } as const;

function issueDateKeys(issue: CalendarConsistencyIssue): string[] {
  const start = new Date(`${issue.startDateTime.slice(0, 10)}T12:00:00`);
  const end = new Date(`${issue.endDateTime.slice(0, 10)}T12:00:00`);
  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    result.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function CalendarView({ events, locations, timeFormat, dayConstraints, dayAttributes, consistencyIssues, onToggleWorkAvailabilityExclusion, onToggleTradingSunday, onAcknowledgeConsistency, onAdd, onAddMany, onEdit, onStudyCorrect, onStudySeriesCorrect, availabilityPlans = [], coworkersByEvent = {}, onOpenAvailability }: CalendarViewProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([]);
  const days = useMemo(() => createMonthGrid(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (!selectionMode) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelectionMode(false); setSelectedDateKeys([]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectionMode]);

  const countsByDate = useMemo(() => categoryCountsByDate(events), [events]);
  const availabilityByDate = useMemo(() => { const map = new Map<string, Array<{ id: string; startTime: string; endTime: string; status: string; planStatus: string; origin?: string; validationState?: string; validationMessage?: string }>>(); for (const plan of availabilityPlans) for (const block of plan.blocks.filter((item) => item.status !== 'REJECTED')) map.set(block.date, [...(map.get(block.date) ?? []), { id: block.id, startTime: block.startTime, endTime: block.endTime, status: block.status, planStatus: plan.status, ...(block.origin ? { origin: block.origin } : {}), ...(block.validationState ? { validationState: block.validationState } : {}), ...(block.validationMessage ? { validationMessage: block.validationMessage } : {}) }]); return map; }, [availabilityPlans]);
  const dayRuleByDate = useMemo(() => { const map = new Map<string, NonNullable<AvailabilityPlan['dayRules']>[number]>(); for (const plan of availabilityPlans) for (const rule of plan.dayRules ?? []) map.set(rule.date, rule); return map; }, [availabilityPlans]);
  const issuesByDate = useMemo(() => {
    const map = new Map<string, CalendarConsistencyIssue[]>();
    for (const issue of consistencyIssues.filter((item) => !item.acknowledged)) {
      for (const key of issueDateKeys(issue)) map.set(key, [...(map.get(key) ?? []), issue]);
    }
    return map;
  }, [consistencyIssues]);

  const seriesCountById = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((event) => { if (event.seriesId && event.seriesType === 'MANUAL_MULTI_DATE') map.set(event.seriesId, (map.get(event.seriesId) ?? 0) + 1); });
    return map;
  }, [events]);

  const selectedKey = toLocalDateKey(selectedDate);
  const selectedEvents = sortEventsForDay(events.filter((event) => eventOccursOnDate(event, selectedKey)));
  const selectedAvailability = [...(availabilityByDate.get(selectedKey) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const locationMap = new Map(locations.map((location) => [location.id, location]));
  const excludedAvailabilityDates = useMemo(() => new Set(dayConstraints.filter((constraint) => constraint.active && constraint.type === 'EXCLUDE_FROM_WORK_AVAILABILITY').map((constraint) => constraint.date)), [dayConstraints]);
  const tradingSundays = useMemo(() => new Set(dayAttributes.filter((attribute) => attribute.active && attribute.type === 'TRADING_SUNDAY').map((attribute) => attribute.date)), [dayAttributes]);
  const selectedExcludedFromAvailability = excludedAvailabilityDates.has(selectedKey);
  const selectedIsSunday = new Date(`${selectedKey}T12:00:00`).getDay() === 0;
  const selectedIsTradingSunday = tradingSundays.has(selectedKey);
  const selectedDayRule = dayRuleByDate.get(selectedKey);

  function changeMonth(amount: number) {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
    setVisibleMonth(next); if (!selectionMode) setSelectedDate(next);
  }
  function toggleSelection(key: string) { setSelectedDateKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key].sort()); }
  function beginSelection() { setSelectionMode(true); setSelectedDateKeys([]); }
  function cancelSelection() { setSelectionMode(false); setSelectedDateKeys([]); }
  function addSelectedDates() { if (!selectedDateKeys.length) return; const values = [...selectedDateKeys]; cancelSelection(); onAddMany(values); }

  return (
    <section className="view-shell calendar-texture-surface">
      <header className="view-header calendar-view-header">
        <div><p className="eyebrow">Kalendarz</p><h1>Plan miesiąca</h1><p className="view-subtitle">Ręczne wydarzenia, studia i praca są rozróżnione kategoriami. Niespójności są wykrywane bez zmieniania danych.</p></div>
        <div className="calendar-header-actions"><button type="button" className="button button-secondary" onClick={selectionMode ? cancelSelection : beginSelection}>{selectionMode ? 'Zakończ wybór' : 'Wybierz dni'}</button><button type="button" className="button button-primary" onClick={() => onAdd(selectedDate)}>+ Dodaj wydarzenie</button></div>
      </header>

      <div className="calendar-category-legend" aria-label="Legenda kategorii wydarzeń">
        {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((category) => <span key={category}><i className={`category-dot category-${category.toLowerCase()}`} aria-hidden="true" />{categoryLabels[category]}</span>)}
      </div>

      <div className="calendar-layout">
        <div className="panel calendar-panel">
          <div className="calendar-toolbar"><button type="button" className="icon-button soft" onClick={() => changeMonth(-1)} aria-label="Poprzedni miesiąc">‹</button><h2>{formatMonthLabel(visibleMonth)}</h2><button type="button" className="icon-button soft" onClick={() => changeMonth(1)} aria-label="Następny miesiąc">›</button></div>
          {selectionMode ? <div className="multi-day-selection-bar" role="status" aria-live="polite"><div><strong>{selectedDateKeys.length} {selectedDateKeys.length === 1 ? 'dzień zaznaczony' : 'dni zaznaczone'}</strong><span>Klikaj kolejne daty. Mogą być niekolejne.</span></div><div className="multi-day-selection-actions"><button type="button" className="button button-secondary button-small" onClick={() => setSelectedDateKeys([])}>Wyczyść</button><button type="button" className="button button-primary button-small" disabled={!selectedDateKeys.length} onClick={addSelectedDates}>Dodaj wydarzenie</button></div></div> : null}
          <div className="calendar-weekdays">{weekdayLabels.map((day) => <span key={day}>{day}</span>)}</div>
          <div className={selectionMode ? 'calendar-grid selection-mode' : 'calendar-grid'}>
            {days.map((day) => {
              const key = toLocalDateKey(day);
              const counts = countsByDate.get(key) ?? { STUDY: 0, WORK: 0, PERSONAL: 0, OTHER: 0 };
              const total = counts.STUDY + counts.WORK + counts.PERSONAL + counts.OTHER;
              const issueCount = issuesByDate.get(key)?.length ?? 0;
              const selected = key === selectedKey;
              const multiSelected = selectedDateKeys.includes(key);
              const isToday = key === toLocalDateKey(new Date());
              const ariaCounts = (Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).filter((category) => counts[category] > 0).map((category) => `${categoryLabels[category]}: ${counts[category]}`).join(', ') || 'brak wydarzeń';
              return <button type="button" key={key} className={`calendar-day${sameMonth(day, visibleMonth) ? '' : ' muted'}${!selectionMode && selected ? ' selected' : ''}${multiSelected ? ' multi-selected' : ''}${isToday ? ' today' : ''}`} onClick={() => selectionMode ? toggleSelection(key) : setSelectedDate(day)} aria-pressed={selectionMode ? multiSelected : undefined} aria-label={`${day.toLocaleDateString('pl-PL')}, ${ariaCounts}${issueCount ? `, niespójności: ${issueCount}` : ''}${selectionMode ? multiSelected ? ', zaznaczony' : ', niezaznaczony' : ''}`}>
                <span className="day-number">{day.getDate()}</span>
                {total > 0 ? <span className="category-count-row">{(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).filter((category) => counts[category] > 0).map((category) => <span key={category} className={`category-count category-${category.toLowerCase()}`} aria-label={`${counts[category]} wydarzenia: ${categoryLabels[category]}`}><i aria-hidden="true" />{counts[category]}</span>)}</span> : <span className="event-placeholder" />}
                {issueCount ? <span className="calendar-conflict-badge" aria-label={`${issueCount} niespójności kalendarza`}>! {issueCount}</span> : null}
                {excludedAvailabilityDates.has(key) ? <span className="availability-excluded-marker" title="Bez automatycznej dyspozycyjności" aria-label="Bez automatycznej dyspozycyjności">×</span> : null}
                {tradingSundays.has(key) ? <span className="trading-sunday-marker" title="Niedziela handlowa" aria-label="Niedziela handlowa">H</span> : null}
                {(availabilityByDate.get(key)?.length ?? 0) > 0 ? <span className="availability-day-marker" title="Dyspozycyjność" aria-label={`${availabilityByDate.get(key)?.length ?? 0} bloków dyspozycyjności`}>D {availabilityByDate.get(key)?.length}</span> : null}
                {ruleLabel(dayRuleByDate.get(key)) ? <span className={`availability-rule-marker${dayRuleByDate.get(key)?.excluded ? ' excluded' : ''}`} title="Ręczne ograniczenie dyspozycyjności">{ruleLabel(dayRuleByDate.get(key))}</span> : null}
                {multiSelected ? <span className="multi-select-check" aria-hidden="true">✓</span> : null}
              </button>;
            })}
          </div>
        </div>

        <aside className="panel selected-day-panel">
          <div className="panel-heading compact-heading"><div><span className="section-kicker">{selectionMode ? 'Tryb wyboru' : 'Wybrany dzień'}</span><h2>{selectionMode ? `${selectedDateKeys.length} zaznaczonych` : selectedDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}</h2></div></div>
          {!selectionMode ? <>
            <div className="selected-day-quick-actions"><button type="button" className="button button-secondary button-small" onClick={() => onOpenAvailability(selectedKey)}>Dyspozycyjność</button></div>
            {selectedDayRule ? <div className={`availability-rule-summary${selectedDayRule.excluded ? ' excluded' : ''}`}><span>{selectedDayRule.excluded ? 'Dyspozycyjność wyłączona' : `Ograniczenie: ${ruleLabel(selectedDayRule) ?? 'ustawione'}`}</span><button type="button" className="text-button" onClick={() => onOpenAvailability(selectedKey)}>Edytuj</button></div> : null}
            {selectedExcludedFromAvailability ? <div className="availability-legacy-exclusion"><span>Starsze wykluczenie dnia jest aktywne.</span><button type="button" className="text-button" onClick={() => void onToggleWorkAvailabilityExclusion(selectedKey, false)}>Przywróć</button></div> : null}
            {selectedIsSunday ? <label className={selectedIsTradingSunday ? 'day-constraint-toggle trading active compact' : 'day-constraint-toggle trading compact'}><input type="checkbox" checked={selectedIsTradingSunday} onChange={(event) => void onToggleTradingSunday(selectedKey, event.target.checked)} /><span><strong>Niedziela handlowa</strong><small>Wymagane, aby dodać dyspozycyjność w niedzielę.</small></span></label> : null}
          </> : null}
          {selectionMode ? <div className="selection-help"><p>Zaznacz dni w siatce po lewej, a potem utwórz jedno wydarzenie wielodniowe albo serię na wybranych datach.</p><button type="button" className="button button-primary" disabled={!selectedDateKeys.length} onClick={addSelectedDates}>Dodaj dla wybranych dni</button></div> : <>{selectedEvents.length ? <div className="event-list compact-event-list">{selectedEvents.map((event) => <EventCard key={event.id} event={event} location={event.locationId ? locationMap.get(event.locationId) : undefined} timeFormat={timeFormat} seriesCount={event.seriesId ? seriesCountById.get(event.seriesId) : undefined} onEdit={onEdit} onStudyCorrect={onStudyCorrect} workCoworkers={coworkersByEvent[event.id] ?? []} showAllWorkCoworkers />)}</div> : null}{selectedAvailability.length ? <div className="selected-day-availability"><span className="section-kicker">Dyspozycyjność</span>{selectedAvailability.map((block) => <button type="button" key={block.id} className={`availability-overlay-card availability-overlay-button status-${block.status.toLowerCase()}${block.validationState === 'CONFLICT' ? ' has-conflict' : ''}`} aria-label={`${block.status === 'PROPOSED' ? 'Proponowana' : 'Zapisaną'} dyspozycyjność ${block.startTime}-${block.endTime}, edytuj`} onClick={() => onOpenAvailability(selectedKey, block.id)}><div><strong>{block.status === 'PROPOSED' ? 'Proponowana dyspozycyjność' : block.origin === 'MANUAL' ? 'Twoja dyspozycyjność' : 'Dyspozycyjność'}</strong><span>{block.startTime}-{block.endTime}</span></div>{block.validationState === 'CONFLICT' ? <small>{block.validationMessage ?? 'Wymaga poprawy'}</small> : block.planStatus === 'STALE' ? <small>Wymaga ponownego sprawdzenia</small> : null}</button>)}</div> : null}{!selectedEvents.length && !selectedAvailability.length ? <EmptyState title="Brak wydarzeń" description="Ten dzień jest jeszcze pusty." actionLabel="Dodaj tutaj" onAction={() => onAdd(selectedDate)} /> : null}</>}
        </aside>
      </div>

      <ConsistencyCenter issues={consistencyIssues} events={events} onEdit={onEdit} onAcknowledge={onAcknowledgeConsistency} onStudySeriesCorrect={onStudySeriesCorrect} />
    </section>
  );
}
