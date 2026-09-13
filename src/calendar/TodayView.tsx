import { addDaysToDateKey, eventOccursOnDate, formatLongDate, formatShortDateKey, formatTime, sortEventsForDay, toLocalDateKey } from './date.utils';
import type { CalendarEvent } from '../events/event.types';
import type { Location } from '../locations/location.types';
import type { TimeFormat } from '../settings/settings.types';
import type { CalendarConsistencyIssue } from '../planning/planning.types';
import type { AvailabilityPlan } from '../availability/availability.types';
import type { CoworkerOverlap } from '../work/work.types';
import { EventCard } from '../events/EventCard';
import { EmptyState } from '../ui/EmptyState';
import { calendarOverlayMarkersForDate } from './calendar-overlays';

interface TodayViewProps {
  events: CalendarEvent[];
  locations: Location[];
  timeFormat: TimeFormat;
  showPolishHolidays?: boolean;
  showWumAcademicCalendar?: boolean;
  onAdd: (date?: Date) => void;
  onEdit: (event: CalendarEvent) => void;
  onStudyCorrect?: (event: CalendarEvent) => void;
  consistencyIssues?: CalendarConsistencyIssue[];
  onOpenConsistencyCenter?: () => void;
  availabilityPlans?: AvailabilityPlan[];
  coworkersByEvent?: Record<string, CoworkerOverlap[]>;
}

function upcomingCategoryEvent(events: CalendarEvent[], category: 'STUDY' | 'WORK', now: Date): CalendarEvent | undefined {
  const nowMs = now.getTime();
  return [...events]
    .filter((event) => event.category === category && Date.parse(event.endDateTime) >= nowMs)
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))[0];
}

function upcomingWhenLabel(event: CalendarEvent, todayKey: string, timeFormat: TimeFormat): string {
  const eventKey = toLocalDateKey(event.startDateTime);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const dayLabel = eventKey === todayKey ? 'Dzisiaj' : eventKey === tomorrowKey ? 'Jutro' : formatShortDateKey(eventKey);
  return `${dayLabel} · ${event.allDay ? 'cały dzień' : formatTime(event.startDateTime, timeFormat)}`;
}

export function TodayView({ events, locations, timeFormat, showPolishHolidays = true, showWumAcademicCalendar = true, onAdd, onEdit, onStudyCorrect, consistencyIssues = [], onOpenConsistencyCenter, availabilityPlans = [], coworkersByEvent = {} }: TodayViewProps) {
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const todayEvents = sortEventsForDay(events.filter((event) => eventOccursOnDate(event, todayKey)));
  const locationMap = new Map(locations.map((location) => [location.id, location]));
  const seriesCountById = new Map<string, number>();
  events.forEach((event) => {
    if (event.seriesId && event.seriesType === 'MANUAL_MULTI_DATE') seriesCountById.set(event.seriesId, (seriesCountById.get(event.seriesId) ?? 0) + 1);
  });
  const firstEvent = todayEvents[0];
  const blockingToday = consistencyIssues.filter((issue) => !issue.acknowledged && issue.planningImpact === 'BLOCKING' && issue.endDateTime.slice(0, 10) >= todayKey && issue.startDateTime.slice(0, 10) <= todayKey);
  const todayAvailability = availabilityPlans.flatMap((plan) => plan.blocks.filter((block) => block.date === todayKey && block.status !== 'REJECTED').map((block) => ({ ...block, planStatus: plan.status }))).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const hasPlan = todayEvents.length > 0 || todayAvailability.length > 0;
  const nextStudy = upcomingCategoryEvent(events, 'STUDY', today);
  const nextWork = upcomingCategoryEvent(events, 'WORK', today);
  const todayMarkers = calendarOverlayMarkersForDate(todayKey, { showPolishHolidays, showWumAcademicCalendar });
  const eventCountLabel = todayEvents.length === 1
    ? '1 wydarzenie'
    : todayEvents.length % 10 >= 2 && todayEvents.length % 10 <= 4 && (todayEvents.length % 100 < 12 || todayEvents.length % 100 > 14)
      ? `${todayEvents.length} wydarzenia`
      : `${todayEvents.length} wydarzeń`;
  const firstPlanLabel = firstEvent
    ? firstEvent.allDay
      ? 'cały dzień'
      : toLocalDateKey(firstEvent.startDateTime) < todayKey
        ? 'w toku'
        : formatTime(firstEvent.startDateTime, timeFormat)
    : '';
  const subtitle = todayEvents.length
    ? `${eventCountLabel} - najbliższe: ${firstPlanLabel}`
    : todayAvailability.length
      ? 'Nie masz dziś wydarzeń w kalendarzu. Masz zapisaną dyspozycyjność.'
      : 'Nie masz dziś zaplanowanych wydarzeń.';

  return (
    <section className={`view-shell today-view${hasPlan ? ' has-plan' : ' is-empty'}`}>
      <header className="view-header hero-header today-header">
        <div>
          <p className="eyebrow">Dzisiaj</p>
          <h1>{formatLongDate(today)}</h1>
          {hasPlan ? <p className="view-subtitle">{subtitle}</p> : null}
          {todayMarkers.length ? <div className="today-calendar-context" aria-label="Informacje o dzisiejszym dniu">{todayMarkers.map((marker) => <span key={marker.kind}>{marker.label}</span>)}</div> : null}
        </div>
        <div className="today-header-actions" />
      </header>

      {(nextStudy || nextWork) ? <section className="today-glance-grid" aria-label="Najbliższe zajęcia i praca">
        {nextStudy ? <article className="today-glance-card category-study"><span className="section-kicker">Najbliższe zajęcia</span><strong>{nextStudy.title}</strong><small>{upcomingWhenLabel(nextStudy, todayKey, timeFormat)}{nextStudy.locationId && locationMap.get(nextStudy.locationId)?.name ? ` · ${locationMap.get(nextStudy.locationId)?.name}` : nextStudy.locationText ? ` · ${nextStudy.locationText}` : ''}</small></article> : <article className="today-glance-card is-empty"><span className="section-kicker">Najbliższe zajęcia</span><strong>Brak zaplanowanych</strong><small>Nie ma kolejnych zajęć w aktualnym kalendarzu.</small></article>}
        {nextWork ? <article className="today-glance-card category-work"><span className="section-kicker">Najbliższa praca</span><strong>{nextWork.allDay ? nextWork.title : `${formatTime(nextWork.startDateTime, timeFormat)}-${formatTime(nextWork.endDateTime, timeFormat)}`}</strong><small>{upcomingWhenLabel(nextWork, todayKey, timeFormat)}{nextWork.locationId && locationMap.get(nextWork.locationId)?.name ? ` · ${locationMap.get(nextWork.locationId)?.name}` : nextWork.locationText ? ` · ${nextWork.locationText}` : ''}{(coworkersByEvent[nextWork.id]?.length ?? 0) ? ` · ${coworkersByEvent[nextWork.id]?.length} os. z Tobą` : ''}</small></article> : <article className="today-glance-card is-empty"><span className="section-kicker">Najbliższa praca</span><strong>Brak zaplanowanej zmiany</strong><small>Nie ma kolejnej zmiany w aktualnym grafiku.</small></article>}
      </section> : null}

      {blockingToday.length ? <div className="today-conflict-banner" role="alert"><div><strong>Plan na dziś zawiera {blockingToday.length === 1 ? 'konflikt' : `${blockingToday.length} konflikty`}</strong><span>Sprawdź niespójności przed automatycznym planowaniem pracy.</span></div>{onOpenConsistencyCenter ? <button type="button" className="button button-secondary button-small" onClick={onOpenConsistencyCenter}>Sprawdź</button> : null}</div> : null}

      <div className={`panel timeline-panel${hasPlan ? ' today-plan-panel today-single-surface' : ' today-empty-panel'}`}>
        {todayEvents.length ? (
          <div className="event-list today-event-list">
            {todayEvents.map((event) => (
              <EventCard key={event.id} event={event} location={event.locationId ? locationMap.get(event.locationId) : undefined} timeFormat={timeFormat} seriesCount={event.seriesId ? seriesCountById.get(event.seriesId) : undefined} onEdit={onEdit} onStudyCorrect={onStudyCorrect} workCoworkers={coworkersByEvent[event.id] ?? []} showAllWorkCoworkers compactTimeRange />
            ))}
          </div>
        ) : todayAvailability.length ? null : (
          <EmptyState icon="calendar" title="Wolny dzień" description="" actionLabel="+ Dodaj" onAction={() => onAdd(today)} />
        )}
        {todayAvailability.length ? <div className="today-availability-list">{todayAvailability.map((block) => <article key={block.id} className={`availability-overlay-card status-${block.status.toLowerCase()}${block.validationState === 'CONFLICT' ? ' has-conflict' : ''}`} aria-label={`${block.status === 'PROPOSED' ? 'Proponowana' : 'Zaakceptowana'} dyspozycyjność ${block.startTime}-${block.endTime}`}><div><strong>{block.status === 'PROPOSED' ? 'Proponowana dyspozycyjność' : block.origin === 'MANUAL' ? 'Twoja dyspozycyjność' : 'Dyspozycyjność'}</strong><span>{block.startTime}-{block.endTime}</span></div>{block.validationState === 'CONFLICT' ? <small>{block.validationMessage ?? 'Wymaga poprawy'}</small> : block.planStatus === 'STALE' ? <small>Wymaga ponownego sprawdzenia</small> : null}</article>)}</div> : null}
        {hasPlan ? <div className="today-add-row"><button type="button" className="button button-primary today-add-button" onClick={() => onAdd(today)}>+ Dodaj wydarzenie</button></div> : null}
      </div>
    </section>
  );
}
