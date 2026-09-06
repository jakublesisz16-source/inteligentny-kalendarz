import { eventDayCount, formatEventDateRange, formatTime } from '../calendar/date.utils';
import type { CalendarEvent } from './event.types';
import type { Location } from '../locations/location.types';
import { buildGoogleMapsDirectionsUrl } from '../locations/google-maps';
import type { TimeFormat } from '../settings/settings.types';
import { importIssueLabel } from '../study/import-review';
import type { CoworkerOverlap } from '../work/work.types';
import { studyEventDisplay } from './study-event-display';

const categoryLabels = {
  STUDY: 'Studia',
  WORK: 'Praca',
  PERSONAL: 'Prywatne',
  OTHER: 'Inne',
} as const;

interface EventCardProps {
  event: CalendarEvent;
  location?: Location | undefined;
  timeFormat: TimeFormat;
  seriesCount?: number | undefined;
  onEdit: (event: CalendarEvent) => void;
  onStudyCorrect?: ((event: CalendarEvent) => void) | undefined;
  workCoworkers?: CoworkerOverlap[] | undefined;
  showAllWorkCoworkers?: boolean | undefined;
}

export function EventCard({ event, location, timeFormat, seriesCount, onEdit, onStudyCorrect, workCoworkers = [], showAllWorkCoworkers = false }: EventCardProps) {
  const hasStudyIssues = event.source === 'UNIVERSITY_XLSX' && Boolean(event.studyIssueCodes?.length);
  const multiDay = event.spanType === 'MULTI_DAY' || eventDayCount(event) > 1;
  const directionsUrl = location ? buildGoogleMapsDirectionsUrl(location) : undefined;
  const visibleWorkCoworkers = showAllWorkCoworkers ? workCoworkers : workCoworkers.slice(0, 4);
  const hiddenWorkCoworkerCount = Math.max(0, workCoworkers.length - visibleWorkCoworkers.length);
  const studyDisplay = studyEventDisplay(event);
  const locationText = location
    ? location.name.trim().toLocaleLowerCase('pl-PL') === location.address.trim().toLocaleLowerCase('pl-PL')
      ? location.address
      : `${location.name} - ${location.address}`
    : undefined;
  return (
    <article className={`event-card category-${event.category.toLowerCase()}${multiDay ? ' multi-day-event-card' : ''}${event.allDay ? ' all-day-event-card' : ''}`}>
      <div className="event-time">
        {event.allDay ? <><strong>Cały dzień</strong>{multiDay ? <span>{formatEventDateRange(event)}</span> : <span>bez godzin</span>}</> : multiDay ? <><strong>Wiele dni</strong><span>{formatEventDateRange(event)}</span></> : <><strong>{formatTime(event.startDateTime, timeFormat)}</strong><span>{formatTime(event.endDateTime, timeFormat)}</span></>}
        {studyDisplay.groupLabel ? <span className="event-study-group">{studyDisplay.groupLabel}</span> : null}
      </div>
      <div className="event-content">
        <div className="event-heading-row">
          <h3>{event.title}</h3><span className="event-category">{categoryLabels[event.category]}</span>
          {event.source === 'UNIVERSITY_XLSX' ? <span className="event-source">Plan studiów{event.userModified ? ' - zmieniono ręcznie' : ''}</span> : null}
          {event.source === 'WORK_PDF' ? <span className="event-source">Grafik pracy{event.userModified ? ' - zmieniono ręcznie' : ''}</span> : null}
          {event.seriesType === 'MANUAL_MULTI_DATE' && seriesCount ? <span className="event-series-badge">Seria: {seriesCount} dni</span> : null}
          {multiDay && event.source === 'MANUAL' ? <span className="event-series-badge">{eventDayCount(event)} dni</span> : null}
          {hasStudyIssues ? <span className="event-review-badge">DO SPRAWDZENIA</span> : null}
        </div>
        {multiDay ? <p className="event-span-note">{event.allDay ? `${formatEventDateRange(event)} - całe dni` : `${formatEventDateRange(event)} - start ${formatTime(event.startDateTime, timeFormat)}, koniec ${formatTime(event.endDateTime, timeFormat)}`}</p> : null}
        {locationText ? <p className="event-location">{locationText}</p> : null}
        {studyDisplay.description ? <p className="event-description">{studyDisplay.description}</p> : null}
        {hasStudyIssues ? <p className="event-review-note">Brakujące dane: {(event.studyIssueCodes ?? []).map(importIssueLabel).join(' · ')}</p> : null}
        {event.source === 'WORK_PDF' && workCoworkers.length ? <div className="event-coworkers"><strong>Z Tobą na zmianie</strong><span>{visibleWorkCoworkers.map((person) => <span className="event-coworker-line" key={`${person.displayName}-${person.coworkerStartTime}`}><b>{person.displayName}</b><small>razem {person.overlapStartTime}-{person.overlapEndTime}</small></span>)}{hiddenWorkCoworkerCount ? <small>+{hiddenWorkCoworkerCount} więcej</small> : null}</span></div> : null}
      </div>
      <div className="event-actions-column">
        {directionsUrl ? <a className="text-button" href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Wyznacz trasę do ${location?.name || 'miejsca'} w Mapach Google`}>Trasa</a> : null}
        {hasStudyIssues && onStudyCorrect ? <button type="button" className="text-button warning-text" onClick={() => onStudyCorrect(event)}>Uzupełnij dane</button> : null}
        <button type="button" className="text-button" onClick={() => onEdit(event)}>Edytuj</button>
      </div>
    </article>
  );
}
