import { useMemo, useState } from 'react';
import {
  areDateKeysContiguous,
  combineDateAndTime,
  inferSpanType,
  splitLocalDateTime,
  toLocalDateKey,
  uniqueSortedDateKeys,
} from '../calendar/date.utils';
import type { Location } from '../locations/location.types';
import type {
  CalendarEvent,
  EventCategory,
  EventDraft,
  EventEditScope,
  EventSubmitOptions,
  ManualMultiDateDraft,
} from './event.types';
import { validateEventDraft, validateManualMultiDateDraft } from './event.validation';
import type { CoworkerOverlap } from '../work/work.types';
import { findEventConflicts } from './event-conflicts';

interface EventFormProps {
  event?: CalendarEvent | undefined;
  locations: Location[];
  calendarEvents?: CalendarEvent[];
  initialDate?: Date | undefined;
  initialTitle?: string | undefined;
  initialEndDate?: Date | undefined;
  initialDates?: string[] | undefined;
  onSubmit: (draft: EventDraft, options?: EventSubmitOptions) => Promise<void>;
  workCoworkers?: CoworkerOverlap[] | undefined;
  onDelete?: ((scope?: EventEditScope) => Promise<void>) | undefined;
  onCancel: () => void;
}

type CreationMode = 'STANDARD' | 'MULTI_DAY' | 'MULTI_DATE';

const categoryOptions: Array<{ value: EventCategory; label: string }> = [
  { value: 'STUDY', label: 'Studia' },
  { value: 'WORK', label: 'Praca' },
  { value: 'PERSONAL', label: 'Prywatne' },
  { value: 'OTHER', label: 'Inne' },
];

function formatSelectedDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

function normalizeLocationText(value: string): string {
  return value.trim().toLocaleLowerCase('pl-PL').replace(/\s+/g, ' ');
}

export function EventForm({ event, locations, calendarEvents = [], initialDate, initialTitle = '', initialEndDate, initialDates = [], onSubmit, workCoworkers = [], onDelete, onCancel }: EventFormProps) {
  const normalizedInitialDates = useMemo(() => uniqueSortedDateKeys(initialDates), [initialDates]);
  const hasMultiSelection = !event && normalizedInitialDates.length > 1;
  const contiguousSelection = areDateKeysContiguous(normalizedInitialDates);
  const initialCreationMode: CreationMode = hasMultiSelection ? (contiguousSelection ? 'MULTI_DAY' : 'MULTI_DATE') : 'STANDARD';
  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);

  const defaults = useMemo(() => {
    if (event) {
      const start = splitLocalDateTime(event.startDateTime);
      const end = splitLocalDateTime(event.endDateTime);
      const savedLocation = event.locationId ? locationById.get(event.locationId) : undefined;
      return {
        title: event.title,
        startDate: start.date,
        endDate: end.date,
        startTime: start.time || '09:00',
        endTime: end.time || '10:00',
        allDay: event.allDay,
        category: event.category,
        locationId: event.locationId ?? '',
        locationText: event.locationText ?? savedLocation?.name ?? '',
        description: event.description ?? '',
        availabilityImpact: event.availabilityImpact ?? (event.allDay ? 'NON_BLOCKING' : 'BLOCKING'),
      };
    }
    const fallbackDate = initialDate ? toLocalDateKey(initialDate) : toLocalDateKey(new Date());
    const firstDate = normalizedInitialDates[0] ?? fallbackDate;
    const lastDate = normalizedInitialDates[normalizedInitialDates.length - 1] ?? firstDate;
    const initialHasTime = Boolean(initialDate && (initialDate.getHours() !== 0 || initialDate.getMinutes() !== 0));
    const initialHour = initialDate?.getHours() ?? 9;
    const initialMinute = initialDate?.getMinutes() ?? 0;
    const startTime = initialHasTime ? `${String(initialHour).padStart(2, '0')}:${String(initialMinute).padStart(2, '0')}` : '09:00';
    const endDateTime = initialHasTime && initialDate ? (initialEndDate ?? new Date(initialDate.getTime() + 60 * 60 * 1000)) : null;
    const endTime = endDateTime ? `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}` : '10:00';
    return {
      title: initialTitle,
      startDate: firstDate,
      endDate: endDateTime && toLocalDateKey(endDateTime) !== firstDate ? toLocalDateKey(endDateTime) : lastDate,
      startTime,
      endTime,
      allDay: hasMultiSelection && contiguousSelection,
      category: 'PERSONAL' as EventCategory,
      locationId: '',
      locationText: '',
      description: '',
      availabilityImpact: 'BLOCKING' as const,
    };
  }, [event, initialDate, initialTitle, initialEndDate, normalizedInitialDates, hasMultiSelection, contiguousSelection, locationById]);

  const [creationMode, setCreationMode] = useState<CreationMode>(initialCreationMode);
  const [editScope, setEditScope] = useState<EventEditScope>('SINGLE');
  const [title, setTitle] = useState(defaults.title);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [allDay, setAllDay] = useState(defaults.allDay);
  const [category, setCategory] = useState<EventCategory>(defaults.category);
  const [locationId, setLocationId] = useState(defaults.locationId);
  const [locationText, setLocationText] = useState(defaults.locationText);
  const [description, setDescription] = useState(defaults.description);
  const [availabilityImpact, setAvailabilityImpact] = useState<'BLOCKING' | 'NON_BLOCKING'>(defaults.availabilityImpact);
  const [showDetails, setShowDetails] = useState(Boolean(event?.allDay || event?.description || (event && event.category !== 'PERSONAL') || (event && event.source !== 'MANUAL') || hasMultiSelection));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isManualSeries = event?.source === 'MANUAL' && event.seriesType === 'MANUAL_MULTI_DATE' && Boolean(event.seriesId);
  const canUseAllDay = !event || event.source === 'MANUAL';
  const isManualLocation = !event || event.source === 'MANUAL';
  const isMultiDateCreation = creationMode === 'MULTI_DATE' && normalizedInitialDates.length > 1;
  const isMultiDayCreation = creationMode === 'MULTI_DAY';
  const dateEditingDisabled = Boolean(isManualSeries && editScope === 'SERIES');

  function switchCreationMode(next: CreationMode) {
    setCreationMode(next);
    if (next === 'MULTI_DAY') {
      setAllDay(true);
      setShowDetails(true);
    }
  }

  function manualLocationFields(): Pick<EventDraft, 'locationId' | 'locationText'> {
    const value = locationText.trim();
    if (!value) return {};
    const normalized = normalizeLocationText(value);
    const currentSavedLocation = event?.source === 'MANUAL' && event.locationId ? locationById.get(event.locationId) : undefined;
    if (currentSavedLocation && normalizeLocationText(currentSavedLocation.name) === normalized) return { locationId: currentSavedLocation.id };
    const existing = locations.find((location) => normalizeLocationText(location.name) === normalized || normalizeLocationText(location.address) === normalized);
    if (existing) return { locationId: existing.id };
    return { locationText: value };
  }

  function currentLocationFields(): Pick<EventDraft, 'locationId' | 'locationText'> {
    if (isManualLocation) return manualLocationFields();
    return locationId ? { locationId } : {};
  }

  const potentialConflicts = useMemo(() => {
    if (isMultiDateCreation || allDay || !startDate || !startTime || !endTime) return [];
    const effectiveEndDate = isMultiDayCreation || event?.spanType === 'MULTI_DAY' ? endDate : startDate;
    const startDateTime = combineDateAndTime(startDate, startTime);
    const endDateTime = combineDateAndTime(effectiveEndDate, endTime);
    return findEventConflicts({ startDateTime, endDateTime }, calendarEvents, event?.id);
  }, [allDay, calendarEvents, endDate, endTime, event?.id, event?.spanType, isMultiDateCreation, isMultiDayCreation, startDate, startTime]);

  function conflictTimeLabel(conflict: CalendarEvent): string {
    if (conflict.allDay) return 'cały dzień';
    return `${conflict.startDateTime.slice(11, 16)}-${conflict.endDateTime.slice(11, 16)}`;
  }

  function conflictCategoryLabel(conflict: CalendarEvent): string {
    if (conflict.category === 'STUDY') return 'Studia';
    if (conflict.category === 'WORK') return 'Praca';
    if (conflict.category === 'PERSONAL') return 'Prywatne';
    return 'Inne';
  }

  async function handleSubmit(eventObject: React.FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    setErrors({});
    const locationFields = currentLocationFields();

    if (isMultiDateCreation) {
      const multiDraft: ManualMultiDateDraft = {
        title,
        dates: normalizedInitialDates,
        startTime,
        endTime,
        allDay,
        category,
        availabilityImpact,
        ...locationFields,
        ...(description.trim() ? { description } : {}),
      };
      const validation = validateManualMultiDateDraft(multiDraft);
      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }
      const firstDate = normalizedInitialDates[0] ?? startDate;
      const draft: EventDraft = {
        title,
        startDateTime: allDay ? `${firstDate}T00:00` : combineDateAndTime(firstDate, startTime),
        endDateTime: allDay ? `${firstDate}T23:59` : combineDateAndTime(firstDate, endTime),
        allDay,
        spanType: 'SINGLE_DAY',
        category,
        availabilityImpact,
        ...locationFields,
        ...(description.trim() ? { description } : {}),
      };
      setSaving(true);
      try {
        await onSubmit(draft, { selectedDates: normalizedInitialDates });
      } finally {
        setSaving(false);
      }
      return;
    }

    const effectiveEndDate = isMultiDayCreation || event?.spanType === 'MULTI_DAY' ? endDate : startDate;
    const draft: EventDraft = {
      title,
      startDateTime: allDay ? `${startDate}T00:00` : combineDateAndTime(startDate, startTime),
      endDateTime: allDay ? `${effectiveEndDate}T23:59` : combineDateAndTime(effectiveEndDate, endTime),
      allDay,
      spanType: inferSpanType(`${startDate}T00:00`, `${effectiveEndDate}T23:59`),
      category,
      availabilityImpact,
      ...locationFields,
      ...(description.trim() ? { description } : {}),
    };
    const validation = validateEventDraft(draft);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(draft, { editScope });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const target = isManualSeries && editScope === 'SERIES' ? 'wszystkie wydarzenia z tej serii' : 'to wydarzenie';
    const confirmed = window.confirm(`Usunąć ${target}? Element trafi do Kosza i będzie można go przywrócić.`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      await onDelete(editScope);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form id="event-editor-form" className={`form-stack event-form-minimal${event ? ' event-form-edit' : ' event-form-create'}${hasMultiSelection ? ' event-form-multi-create' : ''}`} onSubmit={handleSubmit} noValidate>
      {event?.source === 'UNIVERSITY_XLSX' ? (
        <div className="source-edit-note">Źródło: plan studiów. Ręczna edycja zostanie zapamiętana jako Twoja zmiana.</div>
      ) : null}
      {event?.source === 'WORK_PDF' ? (
        <div className="source-edit-note">Źródło: grafik pracy PDF. Ręczna korekta zostanie zapamiętana i kolejny grafik nie nadpisze jej po cichu.</div>
      ) : null}
      {event?.source === 'WORK_PDF' && workCoworkers.length ? (
        <section className="work-coworkers-event" aria-label="Osoby na tej samej zmianie">
          <strong>Na zmianie z Tobą</strong>
          <div>{workCoworkers.map((person) => <span key={`${person.displayName}-${person.coworkerStartTime}`}><b>{person.displayName}</b><small>{person.coworkerStartTime}-{person.coworkerEndTime} · razem {person.overlapStartTime}-{person.overlapEndTime}</small></span>)}</div>
        </section>
      ) : null}
      {isManualSeries ? (
        <div className="source-edit-note manual-series-note">
          <strong>Ręczna seria wydarzeń</strong>
          <span>Możesz zmienić tylko ten termin albo wspólne dane całej serii. Daty pozostałych wystąpień nie zostaną zmienione.</span>
        </div>
      ) : null}

      {hasMultiSelection && contiguousSelection ? (
        <fieldset className="event-mode-picker">
          <legend>Jak potraktować {normalizedInitialDates.length} wybranych dni?</legend>
          <label className={creationMode === 'MULTI_DAY' ? 'selected' : ''}>
            <input type="radio" name="creation-mode" checked={creationMode === 'MULTI_DAY'} onChange={() => switchCreationMode('MULTI_DAY')} />
            <span><strong>Jedno wydarzenie wielodniowe</strong><small>Przykład: wyjazd od {formatSelectedDate(normalizedInitialDates[0] ?? '')} do {formatSelectedDate(normalizedInitialDates.at(-1) ?? '')}.</small></span>
          </label>
          <label className={creationMode === 'MULTI_DATE' ? 'selected' : ''}>
            <input type="radio" name="creation-mode" checked={creationMode === 'MULTI_DATE'} onChange={() => switchCreationMode('MULTI_DATE')} />
            <span><strong>To samo wydarzenie każdego dnia</strong><small>Powstanie {normalizedInitialDates.length} osobnych terminów połączonych jedną serią.</small></span>
          </label>
        </fieldset>
      ) : null}

      {hasMultiSelection && !contiguousSelection ? (
        <div className="source-edit-note"><strong>{normalizedInitialDates.length} niekolejnych dni</strong><span>Powstanie osobne wydarzenie w każdym z zaznaczonych dni.</span></div>
      ) : null}

      {isMultiDateCreation ? (
        <div className="selected-date-summary" aria-label={`Wybrano ${normalizedInitialDates.length} dni`}>
          <strong>Wybrane dni</strong>
          <div>{normalizedInitialDates.map((date) => <span key={date}>{formatSelectedDate(date)}</span>)}</div>
        </div>
      ) : null}

      {isManualSeries ? (
        <fieldset className="series-scope-picker">
          <legend>Zakres edycji</legend>
          <label><input type="radio" name="edit-scope" checked={editScope === 'SINGLE'} onChange={() => setEditScope('SINGLE')} /><span>Tylko to wydarzenie</span></label>
          <label><input type="radio" name="edit-scope" checked={editScope === 'SERIES'} onChange={() => setEditScope('SERIES')} /><span>Wszystkie wydarzenia z tej serii</span></label>
        </fieldset>
      ) : null}

      <label className="field full-field">
        <span>Tytuł</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Np. obiad, muzeum, spotkanie" autoFocus />
        {errors.title ? <small className="field-error">{errors.title}</small> : null}
      </label>

      {!isMultiDateCreation ? (
        <div className="form-grid two-columns event-date-grid">
          <label className="field">
            <span>{isMultiDayCreation || event?.spanType === 'MULTI_DAY' ? 'Data początku' : 'Data'}</span>
            <input type="date" value={startDate} disabled={dateEditingDisabled} onChange={(e) => { setStartDate(e.target.value); if (!isMultiDayCreation && event?.spanType !== 'MULTI_DAY') setEndDate(e.target.value); }} />
          </label>
          {isMultiDayCreation || event?.spanType === 'MULTI_DAY' ? (
            <label className="field">
              <span>Data końca</span>
              <input type="date" value={endDate} disabled={dateEditingDisabled} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          ) : <div />}
        </div>
      ) : null}

      {!allDay ? (
        <div className="form-grid two-columns event-time-grid">
          <label className="field"><span>Od</span><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
          <label className="field"><span>Do</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
        </div>
      ) : null}
      {errors.startDateTime || errors.endDateTime || errors.timeRange || errors.dates ? (
        <small className="field-error block-error">{errors.startDateTime ?? errors.endDateTime ?? errors.timeRange ?? errors.dates}</small>
      ) : null}

      {potentialConflicts.length ? (
        <div className="event-conflict-warning" role="status" aria-live="polite">
          <div><strong>Ten termin nachodzi na kalendarz</strong><span>Możesz zapisać wydarzenie, ale sprawdź kolizję.</span></div>
          <ul>
            {potentialConflicts.slice(0, 3).map(({ event: conflict }) => (
              <li key={conflict.id}><b>{conflict.title}</b><span>{conflictTimeLabel(conflict)} · {conflictCategoryLabel(conflict)}</span></li>
            ))}
          </ul>
          {potentialConflicts.length > 3 ? <small>+{potentialConflicts.length - 3} kolejne kolizje</small> : null}
        </div>
      ) : null}

      {isManualLocation ? (
        <label className="field full-field event-location-input">
          <span>Miejsce <em>opcjonalnie</em></span>
          <input list="event-location-suggestions" value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder="Wpisz dowolne miejsce, np. Louvre albo Hotel Central" autoComplete="off" />
          <datalist id="event-location-suggestions">
            {locations.map((location) => <option key={location.id} value={location.name}>{location.address}</option>)}
          </datalist>
          <small>Możesz wpisać własne miejsce albo wybrać zapisane z podpowiedzi.</small>
        </label>
      ) : (
        <label className="field full-field">
          <span>Miejsce</span>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Bez lokalizacji</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
      )}

      <button type="button" className="event-details-toggle" aria-expanded={showDetails} onClick={() => setShowDetails((current) => !current)}>
        <span>{showDetails ? 'Mniej opcji' : 'Więcej opcji'}</span><i aria-hidden="true">{showDetails ? '−' : '+'}</i>
      </button>

      {showDetails ? (
        <div className="event-advanced-options">
          {canUseAllDay ? (
            <label className="all-day-toggle">
              <input type="checkbox" checked={allDay} onChange={(e) => { const checked = e.target.checked; setAllDay(checked); setAvailabilityImpact(checked ? 'NON_BLOCKING' : 'BLOCKING'); }} />
              <span><strong>Cały dzień</strong><small>Godziny nie będą wyświetlane w kalendarzu.</small></span>
            </label>
          ) : null}

          {event?.source === 'MANUAL' || !event ? (
            <label className={availabilityImpact === 'BLOCKING' ? 'all-day-toggle planning-impact-toggle active' : 'all-day-toggle planning-impact-toggle'}>
              <input type="checkbox" checked={availabilityImpact === 'BLOCKING'} onChange={(e) => setAvailabilityImpact(e.target.checked ? 'BLOCKING' : 'NON_BLOCKING')} />
              <span><strong>Blokuje czas przy planowaniu</strong><small>{allDay ? 'Włącz, jeśli całodniowe wydarzenie ma wykluczyć ten dzień z wolnych okien.' : 'Wyłącz tylko, jeśli wydarzenie ma być informacyjne.'}</small></span>
            </label>
          ) : null}

          <label className="field full-field">
            <span>Kategoria</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}>
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="field full-field">
            <span>Notatka <em>opcjonalnie</em></span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Dodatkowe informacje tylko jeśli są potrzebne" />
          </label>
        </div>
      ) : null}

      <footer className="modal-actions split-actions">
        <div>{onDelete ? <button type="button" className="button button-danger-ghost" onClick={() => void handleDelete()} disabled={deleting || saving}>{deleting ? 'Usuwanie...' : isManualSeries && editScope === 'SERIES' ? 'Usuń całą serię' : 'Usuń'}</button> : null}</div>
        <div className="action-group">
          <button type="button" className="button button-secondary" onClick={onCancel} disabled={saving || deleting}>Anuluj</button>
          <button type="submit" className="button button-primary" disabled={saving || deleting}>{saving ? 'Zapisywanie...' : event ? (isManualSeries && editScope === 'SERIES' ? 'Zapisz całą serię' : 'Zapisz zmiany') : isMultiDateCreation ? `Utwórz ${normalizedInitialDates.length} wydarzenia` : 'Dodaj wydarzenie'}</button>
        </div>
      </footer>
    </form>
  );
}
