import { eventOccursOnDate, formatLongDate, formatTime, sortEventsForDay, toLocalDateKey } from './date.utils';
import type { CalendarEvent } from '../events/event.types';
import type { Location } from '../locations/location.types';
import type { TimeFormat } from '../settings/settings.types';
import type { CalendarConsistencyIssue } from '../planning/planning.types';
import type { AvailabilityPlan } from '../availability/availability.types';
import type { CoworkerOverlap } from '../work/work.types';
import { EventCard } from '../events/EventCard';
import { EmptyState } from '../ui/EmptyState';

interface TodayViewProps {
  events: CalendarEvent[];
  locations: Location[];
  timeFormat: TimeFormat;
  onAdd: (date?: Date) => void;
  onEdit: (event: CalendarEvent) => void;
  onStudyCorrect?: (event: CalendarEvent) => void;
  consistencyIssues?: CalendarConsistencyIssue[];
  onOpenConsistencyCenter?: () => void;
  availabilityPlans?: AvailabilityPlan[];
  coworkersByEvent?: Record<string, CoworkerOverlap[]>;
}

export function TodayView({ events, locations, timeFormat, onAdd, onEdit, onStudyCorrect, consistencyIssues = [], onOpenConsistencyCenter, availabilityPlans = [], coworkersByEvent = {} }: TodayViewProps) {
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
        </div>
        <div className="today-header-actions">
          {hasPlan ? <button type="button" className="button button-primary today-add-button" onClick={() => onAdd(today)}>+ Dodaj</button> : null}
        </div>
      </header>

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
      </div>
    </section>
  );
}
