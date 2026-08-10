import { useEffect, useMemo, useState } from 'react';
import { formatMonthLabel, localDateFromKey, sameMonth, toLocalDateKey } from '../calendar/date.utils';
import { reviewCandidate } from './import-review';
import {
  getStudyPreviewDayEvents,
  getStudyPreviewMonthGrid,
  groupStudyPreviewEventsByDate,
  initialStudyPreviewMonth,
  selectStudyPreviewDateForMonth,
  undatedStudyPreviewCount,
} from './study-preview-calendar';
import type { StudyScheduleCandidate } from './study.types';

const weekdays = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'];

function timeLabel(candidate: StudyScheduleCandidate): string {
  return candidate.startTime && candidate.endTime ? `${candidate.startTime}-${candidate.endTime}` : 'Brak pewnych godzin';
}


function classCountLabel(count: number): string {
  if (count === 1) return '1 zajęcie';
  if (count >= 2 && count <= 4) return `${count} zajęcia`;
  return `${count} zajęć`;
}

function detailLabel(candidate: StudyScheduleCandidate): string {
  return [
    candidate.activityType,
    candidate.groupTags.length ? `Grupy: ${candidate.groupTags.join(', ')}` : '',
    candidate.clinic,
    candidate.room,
    candidate.address ?? candidate.locationLabel,
  ].filter(Boolean).join(' - ');
}

interface StudyPreviewCalendarProps {
  candidates: StudyScheduleCandidate[];
}

export function StudyPreviewCalendar({ candidates }: StudyPreviewCalendarProps) {
  const grouped = useMemo(() => groupStudyPreviewEventsByDate(candidates), [candidates]);
  const [visibleMonth, setVisibleMonth] = useState(() => initialStudyPreviewMonth(candidates));
  const [selectedDateKey, setSelectedDateKey] = useState(() => selectStudyPreviewDateForMonth(initialStudyPreviewMonth(candidates), grouped));

  useEffect(() => {
    const month = initialStudyPreviewMonth(candidates);
    const nextGrouped = groupStudyPreviewEventsByDate(candidates);
    setVisibleMonth(month);
    setSelectedDateKey(selectStudyPreviewDateForMonth(month, nextGrouped));
  }, [candidates]);

  const days = useMemo(() => getStudyPreviewMonthGrid(visibleMonth), [visibleMonth]);
  const selectedEvents = getStudyPreviewDayEvents(grouped, selectedDateKey);
  const undatedCount = undatedStudyPreviewCount(candidates);

  function changeMonth(amount: number) {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
    setVisibleMonth(next);
    setSelectedDateKey(selectStudyPreviewDateForMonth(next, grouped));
  }

  function selectDate(day: Date) {
    if (!sameMonth(day, visibleMonth)) {
      const next = new Date(day.getFullYear(), day.getMonth(), 1);
      setVisibleMonth(next);
    }
    setSelectedDateKey(toLocalDateKey(day));
  }

  const selectedDate = localDateFromKey(selectedDateKey);
  const selectedLabel = new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(selectedDate);
  const todayKey = toLocalDateKey(new Date());

  return (
    <div className="study-preview-calendar-shell">
      <div className="study-preview-calendar-toolbar">
        <button type="button" className="icon-button soft" onClick={() => changeMonth(-1)} aria-label="Poprzedni miesiąc podglądu">‹</button>
        <h3>{formatMonthLabel(visibleMonth)}</h3>
        <button type="button" className="icon-button soft" onClick={() => changeMonth(1)} aria-label="Następny miesiąc podglądu">›</button>
      </div>

      <div className="study-preview-weekdays" aria-hidden="true">
        {weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="study-preview-month-grid" aria-label={`Podgląd planu - ${formatMonthLabel(visibleMonth)}`}>
        {days.map((day) => {
          const key = toLocalDateKey(day);
          const dayEvents = getStudyPreviewDayEvents(grouped, key);
          const inMonth = sameMonth(day, visibleMonth);
          const selected = key === selectedDateKey;
          const isToday = key === todayKey;
          const countText = classCountLabel(dayEvents.length);
          return (
            <button
              type="button"
              key={key}
              className={`study-preview-calendar-day${inMonth ? '' : ' muted'}${selected ? ' selected' : ''}${isToday ? ' today' : ''}`}
              onClick={() => selectDate(day)}
              aria-pressed={selected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${day.toLocaleDateString('pl-PL')}, ${dayEvents.length ? countText : 'brak zajęć'}`}
            >
              <span className="study-preview-day-number">{day.getDate()}</span>
              {dayEvents.length ? (
                <span className="study-preview-study-count" aria-hidden="true">
                  <i />
                  <strong>{dayEvents.length}</strong>
                  <span>{dayEvents.length === 1 ? 'zajęcie' : 'zajęcia'}</span>
                </span>
              ) : <span className="study-preview-empty-marker" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <section className="study-preview-day-details" aria-live="polite">
        <div className="study-preview-day-heading">
          <div>
            <span className="section-kicker">Wybrany dzień</span>
            <h3>{selectedLabel}</h3>
          </div>
          {selectedEvents.length ? <span className="study-preview-day-total">{classCountLabel(selectedEvents.length)}</span> : null}
        </div>
        {selectedEvents.length ? (
          <div className="preview-agenda-events compact-preview-events">
            {selectedEvents.map((candidate) => {
              const review = reviewCandidate(candidate);
              const details = detailLabel(candidate);
              return (
                <article key={candidate.id} className="preview-agenda-event preview-calendar-event">
                  <div className="preview-agenda-time">{timeLabel(candidate)}</div>
                  <div>
                    <strong>{candidate.subject || 'Nieustalony przedmiot'}</strong>
                    {details ? <span>{details}</span> : null}
                  </div>
                  <span className={`status-pill ${review.state.toLowerCase()}`}>{review.state === 'READY' ? 'GOTOWE' : review.state === 'WARNING' ? 'DO SPRAWDZENIA' : 'WYMAGA POPRAWY'}</span>
                </article>
              );
            })}
          </div>
        ) : <p className="study-preview-empty-day">Brak zajęć w tym dniu.</p>}
      </section>

      {undatedCount ? <p className="study-preview-undated-note">{undatedCount} {undatedCount === 1 ? 'wpis nie ma' : 'wpisy nie mają'} pewnej daty. Zobacz {undatedCount === 1 ? 'go' : 'je'} w widoku Lista.</p> : null}
    </div>
  );
}
