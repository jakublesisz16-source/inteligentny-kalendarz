import { useEffect, useMemo, useState } from 'react';
import type { AvailabilityPlan, AvailabilitySentSnapshot } from '../availability/availability.types';
import { localDateFromKey } from '../calendar/date.utils';
import type { CalendarEvent } from '../events/event.types';
import type { WorkScheduleImport } from './work.types';
import { compareAvailabilityWithWorkSchedule, selectDefaultSentSnapshot } from './availability-work-comparison';

interface AvailabilityWorkComparisonPanelProps {
  plans: AvailabilityPlan[];
  workEvents: CalendarEvent[];
  workImports: WorkScheduleImport[];
  onImportClick: () => void;
  openDetailsRequest?: number | undefined;
}

function minutesLabel(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function weekLabel(plan: AvailabilityPlan): string {
  const formatter = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' });
  const endFormatter = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${formatter.format(localDateFromKey(plan.weekStart))} - ${endFormatter.format(localDateFromKey(plan.weekEnd))}`;
}

function dateLabel(dateTime: string): string {
  return new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(localDateFromKey(dateTime.slice(0, 10)));
}

function timeRange(start: string, end: string): string {
  const sameDay = start.slice(0, 10) === end.slice(0, 10);
  return sameDay ? `${start.slice(11, 16)}-${end.slice(11, 16)}` : `${start.slice(11, 16)}-${end.slice(0, 10)} ${end.slice(11, 16)}`;
}

function snapshotLabel(snapshot: AvailabilitySentSnapshot): string {
  return `Wersja ${snapshot.version} - ${new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(snapshot.createdAt))}`;
}

function belongsToWeek(event: CalendarEvent, plan: AvailabilityPlan): boolean {
  const startDate = event.startDateTime.slice(0, 10);
  return startDate >= plan.weekStart && startDate <= plan.weekEnd;
}

export function AvailabilityWorkComparisonPanel({ plans, workEvents, workImports, onImportClick, openDetailsRequest }: AvailabilityWorkComparisonPanelProps) {
  const sentPlans = useMemo(() => plans.filter((plan) => plan.sentSnapshots.length > 0).sort((a, b) => b.weekStart.localeCompare(a.weekStart)), [plans]);
  const activeImports = useMemo(() => workImports.filter((item) => item.lifecycleStatus === 'ACTIVE').sort((a, b) => b.importedAt.localeCompare(a.importedAt) || b.periodStart.localeCompare(a.periodStart)), [workImports]);
  const defaultWeek = useMemo(() => {
    const newestImport = activeImports[0];
    const overlapping = newestImport ? sentPlans.find((plan) => plan.weekEnd >= newestImport.periodStart && plan.weekStart <= newestImport.periodEnd) : undefined;
    return overlapping?.weekStart ?? sentPlans[0]?.weekStart ?? '';
  }, [activeImports, sentPlans]);
  const [weekStart, setWeekStart] = useState(defaultWeek);
  const [snapshotId, setSnapshotId] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showWithin, setShowWithin] = useState(false);

  useEffect(() => { if (openDetailsRequest) setExpanded(true); }, [openDetailsRequest]);

  useEffect(() => {
    if (!weekStart || !sentPlans.some((plan) => plan.weekStart === weekStart)) setWeekStart(defaultWeek);
  }, [defaultWeek, sentPlans, weekStart]);

  const plan = sentPlans.find((item) => item.weekStart === weekStart) ?? sentPlans.find((item) => item.weekStart === defaultWeek);
  const activeImport = useMemo(() => plan ? activeImports.find((item) => plan.weekEnd >= item.periodStart && plan.weekStart <= item.periodEnd) : undefined, [activeImports, plan]);
  const defaultSnapshot = useMemo(() => plan ? selectDefaultSentSnapshot(plan.sentSnapshots, activeImport?.importedAt) : undefined, [activeImport?.importedAt, plan]);

  useEffect(() => {
    if (!plan) { setSnapshotId(''); return; }
    if (!plan.sentSnapshots.some((snapshot) => snapshot.id === snapshotId)) setSnapshotId(defaultSnapshot?.id ?? plan.sentSnapshots.at(-1)?.id ?? '');
  }, [defaultSnapshot, plan, snapshotId]);

  const snapshot = plan?.sentSnapshots.find((item) => item.id === snapshotId) ?? defaultSnapshot;
  const relevantWorkEvents = useMemo(() => {
    if (!plan) return [];
    return workEvents.filter((event) => event.source === 'WORK_PDF'
      && (!activeImport || !event.sourceWorkImportId || event.sourceWorkImportId === activeImport.id)
      && belongsToWeek(event, plan));
  }, [activeImport, plan, workEvents]);
  const comparison = useMemo(() => snapshot ? compareAvailabilityWithWorkSchedule(snapshot, relevantWorkEvents.map((event) => ({ id: event.id, startDateTime: event.startDateTime, endDateTime: event.endDateTime }))) : undefined, [relevantWorkEvents, snapshot]);

  if (!sentPlans.length) {
    return <section className="panel work-comparison-card"><div className="panel-heading compact-heading"><div><span className="section-kicker">Zgodność z dyspozycyjnością</span><h2>Brak wysłanej wersji</h2></div></div><p className="muted-copy">Najpierw oznacz zaakceptowaną dyspozycyjność jako wysłaną. Dopiero taką wersję można uczciwie porównać z grafikiem.</p></section>;
  }

  if (!activeImport) {
    return <section className="panel work-comparison-card"><div className="panel-heading compact-heading"><div><span className="section-kicker">Zgodność z dyspozycyjnością</span><h2>Grafik jeszcze niezaimportowany</h2></div></div><p className="muted-copy">Dyspozycyjność jest zapisana. Zaimportuj grafik pracy, aby sprawdzić zgodność.</p><button type="button" className="button button-secondary button-small" onClick={onImportClick}>Importuj grafik PDF</button></section>;
  }

  if (!plan || !snapshot || !comparison) return null;

  const problemCount = comparison.partiallyOutsideCount + comparison.fullyOutsideCount;
  const problemShifts = comparison.perShift.filter((item) => item.status !== 'WITHIN_AVAILABILITY');
  const withinShifts = comparison.perShift.filter((item) => item.status === 'WITHIN_AVAILABILITY');

  return <section className="panel work-comparison-card">
    <div className="work-comparison-heading">
      <div><span className="section-kicker">Zgodność z dyspozycyjnością</span><h2>{problemCount ? `${problemCount} ${problemCount === 1 ? 'zmiana wymaga uwagi' : 'zmiany wymagają uwagi'}` : 'Grafik mieści się w wysłanej dyspozycyjności'}</h2></div>
      <button type="button" className="button button-secondary button-small" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Ukryj szczegóły' : 'Zobacz szczegóły'}</button>
    </div>
    <div className="work-comparison-metrics" aria-label="Podsumowanie zgodności">
      <div><strong>{comparison.fullyWithinCount}</strong><span>zgodnych</span></div>
      <div className={comparison.partiallyOutsideCount ? 'attention' : ''}><strong>{comparison.partiallyOutsideCount}</strong><span>częściowo poza</span></div>
      <div className={comparison.fullyOutsideCount ? 'attention' : ''}><strong>{comparison.fullyOutsideCount}</strong><span>poza</span></div>
    </div>
    {comparison.unusedAvailabilityMinutes ? <p className="work-comparison-note">Niewykorzystana dyspozycyjność: {minutesLabel(comparison.unusedAvailabilityMinutes)}. To informacja, nie błąd.</p> : null}

    {expanded ? <div className="work-comparison-details">
      <div className="work-comparison-controls">
        <label><span>Tydzień</span><select value={plan.weekStart} onChange={(event) => { setWeekStart(event.target.value); setSnapshotId(''); }}>{sentPlans.map((item) => <option key={item.weekStart} value={item.weekStart}>{weekLabel(item)}</option>)}</select></label>
        <label><span>Wysłana wersja</span><select value={snapshot.id} onChange={(event) => setSnapshotId(event.target.value)}>{[...plan.sentSnapshots].sort((a,b)=>b.version-a.version).map((item) => <option key={item.id} value={item.id}>{snapshotLabel(item)}</option>)}</select></label>
      </div>
      <p className="work-comparison-context">Porównuję z wysłaną wersją {snapshot.version}. Porównanie jest tylko informacyjne i nie zmienia grafiku ani historii dyspozycyjności.</p>

      {problemShifts.length ? <div className="work-comparison-list">{problemShifts.map((item) => <article key={item.workShiftId} className={`work-comparison-shift ${item.status === 'OUTSIDE_AVAILABILITY' ? 'outside' : 'partial'}`}>
        <div className="work-comparison-shift-head"><div><strong>{dateLabel(item.startDateTime)}</strong><span>Grafik: {timeRange(item.startDateTime, item.endDateTime)}</span></div><span className="comparison-status">{item.status === 'OUTSIDE_AVAILABILITY' ? 'Poza dyspozycyjnością' : `${minutesLabel(item.outsideMinutes)} poza dyspozycyjnością`}</span></div>
        {item.matchingAvailabilityIntervals.length ? <p>Wysłana dyspozycyjność pokrywa: {item.matchingAvailabilityIntervals.map((range) => timeRange(range.startDateTime, range.endDateTime)).join(', ')}</p> : <p>W wysłanej wersji nie ma dyspozycyjności pokrywającej tę zmianę.</p>}
        {item.uncoveredIntervals.length ? <div className="comparison-uncovered"><span>Poza wysłaną dyspozycyjnością:</span>{item.uncoveredIntervals.map((range) => <strong key={`${range.startDateTime}-${range.endDateTime}`}>{timeRange(range.startDateTime, range.endDateTime)} - {minutesLabel(range.minutes)}</strong>)}</div> : null}
      </article>)}</div> : <div className="work-comparison-ok" role="status">Wszystkie zmiany z tego tygodnia mieszczą się w wysłanej dyspozycyjności.</div>}

      {withinShifts.length ? <div className="work-comparison-within"><button type="button" className="text-button" aria-expanded={showWithin} onClick={() => setShowWithin((value) => !value)}>{showWithin ? 'Ukryj zgodne zmiany' : `Pokaż zgodne zmiany (${withinShifts.length})`}</button>{showWithin ? <div>{withinShifts.map((item) => <span key={item.workShiftId}>{dateLabel(item.startDateTime)} - {timeRange(item.startDateTime, item.endDateTime)}</span>)}</div> : null}</div> : null}
    </div> : null}
  </section>;
}
