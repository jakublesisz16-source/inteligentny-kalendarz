import { useMemo, useState } from 'react';
import type { CalendarEvent } from '../events/event.types';
import type { Location } from '../locations/location.types';
import { Modal } from '../ui/Modal';
import { buildGlobalSearchItems, searchGlobalItems, searchKindLabel, type GlobalSearchItem } from './global-search';
import { toLocalDateKey } from '../calendar/date.utils';

interface GlobalSearchProps {
  events: CalendarEvent[];
  locations: Location[];
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenLocation: (location: Location) => void;
  onClose: () => void;
}

function formatDateKey(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function eventSubtitle(item: GlobalSearchItem): string {
  const event = item.event;
  if (!event) return '';
  const startDate = event.startDateTime.slice(0, 10);
  const endDate = event.endDateTime.slice(0, 10);
  const startTime = event.startDateTime.slice(11, 16);
  const endTime = event.endDateTime.slice(11, 16);
  const datePart = startDate === endDate
    ? formatDateKey(startDate)
    : `${formatDateKey(startDate)} - ${formatDateKey(endDate)}`;
  const timePart = event.allDay ? 'Cały dzień' : `${startTime}-${endTime}`;
  return [datePart, timePart, item.eventLocation?.name].filter(Boolean).join(' · ');
}

function resultSubtitle(item: GlobalSearchItem): string {
  if (item.location) return item.location.address.trim() || 'Zapisane miejsce';
  return eventSubtitle(item);
}

export function GlobalSearch({ events, locations, onOpenEvent, onOpenLocation, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const items = useMemo(() => buildGlobalSearchItems(events, locations), [events, locations]);
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);
  const response = useMemo(() => searchGlobalItems(items, query, todayKey), [items, query, todayKey]);
  const hasSearchableQuery = query.trim().length >= 2;

  function openResult(item: GlobalSearchItem) {
    if (item.event) onOpenEvent(item.event);
    else if (item.location) onOpenLocation(item.location);
  }

  return (
    <Modal title="Szukaj" onClose={onClose} wide>
      <div className="global-search">
        <label className="field full-field global-search-field">
          <span className="visually-hidden">Szukaj</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj wydarzeń, Studiów, Pracy i Miejsc..."
            autoComplete="off"
            data-modal-autofocus="true"
          />
        </label>

        {!hasSearchableQuery ? (
          <p className="global-search-hint">Szukaj po nazwie, miejscu, adresie lub fragmencie notatki.</p>
        ) : response.totalCount === 0 ? (
          <p className="global-search-empty">Brak wyników.</p>
        ) : (
          <div className="global-search-results" aria-label="Wyniki wyszukiwania">
            {response.results.map((item) => (
              <button
                type="button"
                key={item.id}
                className="global-search-result"
                onClick={() => openResult(item)}
              >
                <span className="global-search-kind">{searchKindLabel(item.kind)}</span>
                <strong>{item.title}</strong>
                <small>{resultSubtitle(item)}</small>
              </button>
            ))}
          </div>
        )}

        {hasSearchableQuery && response.hasMore ? (
          <p className="global-search-more">Znaleziono więcej wyników. Doprecyzuj wyszukiwanie.</p>
        ) : null}

        <p className="global-search-privacy">Wyszukiwanie działa lokalnie na tym urządzeniu.</p>
      </div>
    </Modal>
  );
}
