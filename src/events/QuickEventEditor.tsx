import { useMemo, useState } from 'react';
import { combineDateAndTime, splitLocalDateTime } from '../calendar/date.utils';
import type { Location } from '../locations/location.types';
import type { CalendarEvent, EventDraft } from './event.types';
import { validateEventDraft } from './event.validation';

interface QuickEventEditorProps {
  event: CalendarEvent;
  locations: Location[];
  onSave: (draft: EventDraft) => Promise<void>;
  onMore: () => void;
  onCancel: () => void;
}

function normalizeLocationText(value: string): string {
  return value.trim().toLocaleLowerCase('pl-PL').replace(/\s+/g, ' ');
}

export function QuickEventEditor({ event, locations, onSave, onMore, onCancel }: QuickEventEditorProps) {
  const start = useMemo(() => splitLocalDateTime(event.startDateTime), [event.startDateTime]);
  const end = useMemo(() => splitLocalDateTime(event.endDateTime), [event.endDateTime]);
  const savedLocation = useMemo(() => event.locationId ? locations.find((location) => location.id === event.locationId) : undefined, [event.locationId, locations]);
  const [title, setTitle] = useState(event.title);
  const [startTime, setStartTime] = useState(start.time || '09:00');
  const [endTime, setEndTime] = useState(end.time || '10:00');
  const [locationText, setLocationText] = useState(event.locationText ?? savedLocation?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function locationFields(): Pick<EventDraft, 'locationId' | 'locationText'> {
    const value = locationText.trim();
    if (!value) return {};
    const normalized = normalizeLocationText(value);
    const matched = locations.find((location) => normalizeLocationText(location.name) === normalized || normalizeLocationText(location.address) === normalized);
    if (matched) return { locationId: matched.id };
    return { locationText: value };
  }

  async function submit(eventObject: React.FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    if (saving) return;
    const draft: EventDraft = {
      title,
      startDateTime: combineDateAndTime(start.date, startTime),
      endDateTime: combineDateAndTime(start.date, endTime),
      allDay: false,
      spanType: 'SINGLE_DAY',
      category: event.category,
      availabilityImpact: event.availabilityImpact ?? 'BLOCKING',
      ...locationFields(),
      ...(event.description ? { description: event.description } : {}),
    };
    const validation = validateEventDraft(draft);
    if (!validation.valid) {
      setError(validation.errors.title || validation.errors.timeRange || validation.errors.startDateTime || validation.errors.endDateTime || 'Sprawdź dane wydarzenia.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się zapisać zmian.');
      setSaving(false);
    }
  }

  return (
    <form className="selected-day-quick-editor" onSubmit={(eventObject) => void submit(eventObject)} onKeyDown={(eventObject) => { if (eventObject.key === 'Escape') onCancel(); }}>
      <div className="selected-day-quick-editor-heading">
        <strong>Szybka edycja</strong>
        <button type="button" onClick={onCancel} aria-label="Zamknij szybką edycję">×</button>
      </div>
      <label>
        <span>Nazwa</span>
        <input value={title} onChange={(eventObject) => { setTitle(eventObject.target.value); setError(''); }} autoFocus />
      </label>
      <div className="selected-day-quick-editor-times">
        <label><span>Od</span><input type="time" value={startTime} onChange={(eventObject) => { setStartTime(eventObject.target.value); setError(''); }} /></label>
        <label><span>Do</span><input type="time" value={endTime} onChange={(eventObject) => { setEndTime(eventObject.target.value); setError(''); }} /></label>
      </div>
      <label>
        <span>Miejsce <small>opcjonalnie</small></span>
        <input list="quick-event-location-suggestions" value={locationText} onChange={(eventObject) => setLocationText(eventObject.target.value)} placeholder="Wpisz dowolne miejsce" />
        <datalist id="quick-event-location-suggestions">
          {locations.map((location) => <option key={location.id} value={location.name}>{location.address}</option>)}
        </datalist>
      </label>
      {event.seriesId ? <small className="selected-day-quick-editor-note">Ta szybka zmiana dotyczy tylko tego wystąpienia.</small> : null}
      {error ? <small className="selected-day-quick-editor-error" role="alert">{error}</small> : null}
      <div className="selected-day-quick-editor-actions">
        <button type="button" className="text-button" onClick={onMore}>Więcej opcji</button>
        <button type="submit" className="button button-primary button-small" disabled={saving}>{saving ? 'Zapisywanie...' : 'Zapisz'}</button>
      </div>
    </form>
  );
}
