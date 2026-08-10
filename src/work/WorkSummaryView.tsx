import { useEffect, useMemo, useState } from 'react';
import type { AvailabilityPlan } from '../availability/availability.types';
import { formatMonthLabel, localDateFromKey } from '../calendar/date.utils';
import type { CalendarEvent } from '../events/event.types';
import { compareAvailabilityWithWorkSchedule, selectDefaultSentSnapshot } from './availability-work-comparison';
import type { WorkScheduleImport } from './work.types';
import { aggregateAvailabilityComparisonResults, buildWorkMonthlySummary, dedupeConfirmedWorkShifts, formatWorkSummaryMinutes } from './work-summary';

interface WorkSummaryViewProps {
  workEvents: CalendarEvent[];
  workImports: WorkScheduleImport[];
  availabilityPlans: AvailabilityPlan[];
  onImportClick: () => void;
  onOpenComparison: () => void;
  onOpenAvailability: () => void;
  initialMonth?: string | undefined;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(monthKey: string, amount: number): string {
  const [yearText = '', monthText = ''] = monthKey.split('-');
  const date = new Date(Number(yearText), Number(monthText) - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(monthKey: string): { start: string; endExclusive: string } {
  return { start: `${monthKey}-01T00:00`, endExclusive: `${shiftMonth(monthKey, 1)}-01T00:00` };
}

function eventOverlapsMonth(event: CalendarEvent, monthKey: string): boolean {
  const range = monthRange(monthKey);
  return event.startDateTime < range.endExclusive && event.endDateTime > range.start;
}

function eventBelongsToPlan(event: CalendarEvent, plan: AvailabilityPlan): boolean {
  const date = event.startDateTime.slice(0, 10);
  return date >= plan.weekStart && date <= plan.weekEnd;
}

function formatWeekRange(startDate: string, endDate: string): string {
  const start = localDateFromKey(startDate);
  const end = localDateFromKey(endDate);
  const startText = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(start);
  const endText = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(end);
  return `${startText} - ${endText}`;
}

function workSummaryShift(event: CalendarEvent) {
  return {
    id: event.id,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    source: event.source as 'MANUAL' | 'WORK_PDF',
  };
}

export function WorkSummaryView({ workEvents, workImports, availabilityPlans, onImportClick, onOpenComparison, onOpenAvailability, initialMonth }: WorkSummaryViewProps) {
  const fallbackMonth = initialMonth && /^\d{4}-\d{2}$/.test(initialMonth) ? initialMonth : currentMonthKey();
  const [monthKey, setMonthKey] = useState(fallbackMonth);

  useEffect(() => {
    if (initialMonth && /^\d{4}-\d{2}$/.test(initialMonth) && !workEvents.some((event) => eventOverlapsMonth(event, monthKey))) setMonthKey(initialMonth);
  }, [initialMonth]);

  const confirmedShifts = useMemo(() => workEvents
    .filter((event) => event.category === 'WORK' && !event.allDay && (event.source === 'MANUAL' || event.source === 'WORK_PDF'))
    .map(workSummaryShift), [workEvents]);
  const summary = useMemo(() => buildWorkMonthlySummary(monthKey, confirmedShifts), [confirmedShifts, monthKey]);
  const pdfEvents = useMemo(() => {
    const dedupedIds = new Set(dedupeConfirmedWorkShifts(workEvents.filter((event) => event.source === 'WORK_PDF' && !event.allDay).map(workSummaryShift)).map((shift) => shift.id));
    return workEvents.filter((event) => dedupedIds.has(event.id) && eventOverlapsMonth(event, monthKey));
  }, [monthKey, workEvents]);

  const comparisonData = useMemo(() => {
    if (!pdfEvents.length) return { comparisons: [], totalPdfShiftCount: 0, sentPlanCount: 0 };
    const activeImports = workImports.filter((item) => item.lifecycleStatus === 'ACTIVE');
    const comparisons = availabilityPlans
      .filter((plan) => plan.sentSnapshots.length > 0)
      .flatMap((plan) => {
        const shifts = pdfEvents.filter((event) => eventBelongsToPlan(event, plan));
        if (!shifts.length) return [];
        const activeImport = activeImports.find((item) => plan.weekEnd >= item.periodStart && plan.weekStart <= item.periodEnd);
        const snapshot = selectDefaultSentSnapshot(plan.sentSnapshots, activeImport?.importedAt);
        if (!snapshot) return [];
        return [compareAvailabilityWithWorkSchedule(snapshot, shifts.map((event) => ({ id: event.id, startDateTime: event.startDateTime, endDateTime: event.endDateTime })))];
      });
    const sentPlanCount = availabilityPlans.filter((plan) => plan.sentSnapshots.length > 0 && pdfEvents.some((event) => eventBelongsToPlan(event, plan))).length;
    return { comparisons, totalPdfShiftCount: pdfEvents.length, sentPlanCount };
  }, [availabilityPlans, pdfEvents, workImports]);

  const comparisonSummary = useMemo(() => aggregateAvailabilityComparisonResults(comparisonData.comparisons), [comparisonData.comparisons]);
  const maxWeeklyMinutes = Math.max(1, ...summary.weeklyBuckets.map((bucket) => bucket.minutes));
  const monthDate = localDateFromKey(`${monthKey}-01`);

  return <section className="work-summary-view" aria-label={`Podsumowanie pracy - ${formatMonthLabel(monthDate)}`}>
    <div className="work-summary-month-nav">
      <button type="button" className="icon-button" aria-label="Poprzedni miesiąc" onClick={() => setMonthKey((value) => shiftMonth(value, -1))}>‹</button>
      <div><span className="section-kicker">Podsumowanie</span><h2>{formatMonthLabel(monthDate)}</h2></div>
      <button type="button" className="icon-button" aria-label="Następny miesiąc" onClick={() => setMonthKey((value) => shiftMonth(value, 1))}>›</button>
    </div>

    {!summary.shiftCount ? <section className="panel work-summary-empty"><h3>Brak danych o pracy w tym miesiącu</h3><p className="muted-copy">Zaimportuj grafik albo dodaj potwierdzoną zmianę pracy, a podsumowanie policzy się automatycznie.</p><button type="button" className="button button-primary" onClick={onImportClick}>Importuj grafik</button></section> : <>
      <section className="work-summary-hero" aria-label="Najważniejsze statystyki miesiąca">
        <div className="work-summary-total"><strong>{formatWorkSummaryMinutes(summary.totalMinutes)}</strong><span>przepracowano</span></div>
        <div className="work-summary-facts">
          <span><strong>{summary.shiftCount}</strong> {summary.shiftCount === 1 ? 'zmiana' : 'zmian'}</span>
          <span><strong>{summary.workDayCount}</strong> {summary.workDayCount === 1 ? 'dzień pracy' : 'dni pracy'}</span>
          <span>Średnio <strong>{summary.averageShiftMinutes !== undefined ? formatWorkSummaryMinutes(summary.averageShiftMinutes) : 'Brak danych'}</strong></span>
          <span>Najdłuższa <strong>{summary.longestShiftMinutes !== undefined ? formatWorkSummaryMinutes(summary.longestShiftMinutes) : 'Brak danych'}</strong></span>
        </div>
        <p className="work-summary-weekend">Soboty: <strong>{summary.saturdayCount}</strong> · Niedziele: <strong>{summary.sundayCount}</strong></p>
      </section>

      <section className="panel work-summary-section">
        <div className="panel-heading compact-heading"><div><span className="section-kicker">Godziny w tygodniach</span><h3>Jak rozłożyła się praca</h3></div></div>
        <div className="work-week-bars" role="img" aria-label={summary.weeklyBuckets.map((bucket) => `${formatWeekRange(bucket.startDate, bucket.endDate)}: ${formatWorkSummaryMinutes(bucket.minutes)}`).join('; ')}>
          {summary.weeklyBuckets.map((bucket) => <div className="work-week-bar-row" key={bucket.startDate}>
            <span>{formatWeekRange(bucket.startDate, bucket.endDate)}</span>
            <div className="work-week-bar-track" aria-hidden="true"><i style={{ width: `${Math.max(3, (bucket.minutes / maxWeeklyMinutes) * 100)}%` }} /></div>
            <strong>{formatWorkSummaryMinutes(bucket.minutes)}</strong>
          </div>)}
        </div>
      </section>

      <section className="panel work-summary-section work-summary-comparison">
        <div className="panel-heading compact-heading"><div><span className="section-kicker">Zgodność z dyspozycyjnością</span><h3>Grafik a wysłane godziny</h3></div></div>
        {!comparisonData.totalPdfShiftCount ? <p className="muted-copy">Porównanie dotyczy zmian z zaimportowanego grafiku PDF. W tym miesiącu nie ma takich zmian.</p> : !comparisonData.sentPlanCount || !comparisonSummary.comparedShiftCount ? <div className="work-summary-comparison-empty"><p>Brak wysłanej dyspozycyjności do porównania.</p><button type="button" className="button button-secondary button-small" onClick={onOpenAvailability}>Przejdź do Dyspozycyjności</button></div> : <>
          <div className="work-summary-comparison-metrics" aria-label="Miesięczne podsumowanie zgodności">
            <div><strong>{comparisonSummary.fullyWithinCount}</strong><span>zgodnych</span></div>
            <div><strong>{comparisonSummary.partiallyOutsideCount}</strong><span>częściowo poza</span></div>
            <div><strong>{comparisonSummary.fullyOutsideCount}</strong><span>poza</span></div>
          </div>
          <div className="work-summary-comparison-bar" aria-label={`${comparisonSummary.fullyWithinCount} zgodnych, ${comparisonSummary.partiallyOutsideCount} częściowo poza, ${comparisonSummary.fullyOutsideCount} poza dyspozycyjnością`}>
            {comparisonSummary.comparedShiftCount ? <>
              <i className="within" style={{ flexGrow: comparisonSummary.fullyWithinCount }} />
              <i className="partial" style={{ flexGrow: comparisonSummary.partiallyOutsideCount }} />
              <i className="outside" style={{ flexGrow: comparisonSummary.fullyOutsideCount }} />
            </> : null}
          </div>
          {comparisonSummary.comparedShiftCount < comparisonData.totalPdfShiftCount ? <p className="work-summary-source-note">Porównano {comparisonSummary.comparedShiftCount} z {comparisonData.totalPdfShiftCount} zmian z grafiku. Dla części miesiąca brakuje wysłanej dyspozycyjności.</p> : null}
          <button type="button" className="button button-secondary button-small" onClick={onOpenComparison}>Zobacz szczegóły w Grafiku</button>
        </>}
      </section>

      <p className="work-summary-source-note">Na podstawie aktualnie zapisanych potwierdzonych zmian. Dyspozycyjność nie jest liczona jako praca.</p>
    </>}
  </section>;
}
