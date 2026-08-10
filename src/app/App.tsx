import { useEffect, useMemo, useState } from 'react';
import type { AppView } from './app.types';
import { Navigation } from '../ui/Navigation';
import { Modal } from '../ui/Modal';
import { AppBackgroundDecor } from '../ui/AppBackgroundDecor';
import { FloralAccent } from '../ui/FloralAccent';
import { AppIcon } from '../ui/AppIcon';
import { GlobalSearch } from '../search/GlobalSearch';
import { TodayView } from '../calendar/TodayView';
import { CalendarView } from '../calendar/CalendarView';
import { LocationsView } from '../locations/LocationsView';
import { SettingsView } from '../settings/SettingsView';
import { StudyView } from '../study/StudyView';
import { WorkView } from '../work/WorkView';
import { ShoppingView } from '../shopping/ShoppingView';
import { CycleView } from '../cycle/CycleView';
import type { CoworkerOverlap } from '../work/work.types';
import { StudyEventCorrection } from '../study/StudyEventCorrection';
import { EventForm } from '../events/EventForm';
import { LocationForm } from '../locations/LocationForm';
import type { CalendarEvent, EventDraft, EventEditScope, EventSubmitOptions, ManualMultiDateDraft } from '../events/event.types';
import type { Location, LocationDraft } from '../locations/location.types';
import type { AppSettings, AppSettingsPatch } from '../settings/settings.types';
import type { DayConstraint } from '../safety/safety.types';
import type { CalendarConsistencyIssue, DayAttribute } from '../planning/planning.types';
import type { AvailabilityPlan } from '../availability/availability.types';
import { refreshAllAvailabilityPlanStatuses } from '../availability/availability.service';
import { DayAvailabilityEditor } from '../availability/DayAvailabilityEditor';
import { StudySeriesTimingCorrection } from '../planning/StudySeriesTimingCorrection';
import { rebuildAndSyncNotifications } from '../notifications/notification-storage';
import { retryPendingNotificationCleanup } from '../notifications/push-client';
import {
  createEvent,
  createManualEventSeries,
  createLocation,
  deleteEvent,
  deleteManualEventSeries,
  deleteLocation,
  getSettings,
  initializeDatabase,
  listEvents,
  listLocations,
  listDayConstraints,
  listDayAttributes,
  listCalendarConsistencyIssues,
  listCoworkersForWorkEvent,
  getLatestReversibleChange,
  setWorkAvailabilityExcluded,
  setTradingSunday,
  acknowledgeConsistencyIssue,
  updateStudySeriesTiming,
  undoChange,
  updateEvent,
  updateManualEventSeries,
  updateLocation,
  updateSettings,
} from '../storage/database';

interface EventEditorState {
  event?: CalendarEvent | undefined;
  workCoworkers?: CoworkerOverlap[] | undefined;
  initialDate?: Date | undefined;
  initialDates?: string[] | undefined;
}

interface LocationEditorState {
  location?: Location | undefined;
}

interface ToastState {
  message: string;
  undoJournalId?: string;
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [dayConstraints, setDayConstraints] = useState<DayConstraint[]>([]);
  const [dayAttributes, setDayAttributes] = useState<DayAttribute[]>([]);
  const [consistencyIssues, setConsistencyIssues] = useState<CalendarConsistencyIssue[]>([]);
  const [availabilityPlans, setAvailabilityPlans] = useState<AvailabilityPlan[]>([]);
  const [coworkersByEvent, setCoworkersByEvent] = useState<Record<string, CoworkerOverlap[]>>({});
  const [view, setView] = useState<AppView>('today');
  const [eventEditor, setEventEditor] = useState<EventEditorState | null>(null);
  const [locationEditor, setLocationEditor] = useState<LocationEditorState | null>(null);
  const [studyCorrectionEvent, setStudyCorrectionEvent] = useState<CalendarEvent | null>(null);
  const [studySeriesTimingEvent, setStudySeriesTimingEvent] = useState<CalendarEvent | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [availabilityEditor, setAvailabilityEditor] = useState<{ date: string; blockId?: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadCoworkerMap(sourceEvents: CalendarEvent[]) {
    const workEvents = sourceEvents.filter((event) => event.source === 'WORK_PDF');
    const pairs = await Promise.all(workEvents.map(async (event) => [event.id, await listCoworkersForWorkEvent(event.id)] as const));
    return Object.fromEntries(pairs) as Record<string, CoworkerOverlap[]>;
  }

  async function bootstrap() {
    try {
      await initializeDatabase();
      const [loadedEvents, loadedLocations, loadedSettings, loadedConstraints, loadedAttributes, loadedIssues, loadedAvailability] = await Promise.all([
        listEvents(),
        listLocations(),
        getSettings(),
        listDayConstraints(),
        listDayAttributes(),
        listCalendarConsistencyIssues(),
        refreshAllAvailabilityPlanStatuses(),
      ]);
      setEvents(loadedEvents);
      setLocations(loadedLocations);
      setSettings(loadedSettings);
      setDayConstraints(loadedConstraints);
      setDayAttributes(loadedAttributes);
      setConsistencyIssues(loadedIssues);
      setAvailabilityPlans(loadedAvailability);
      setCoworkersByEvent(await loadCoworkerMap(loadedEvents));
      setView(loadedSettings.preferredStartView);
      void retryPendingNotificationCleanup().then(() => rebuildAndSyncNotifications()).catch(() => undefined);
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : 'Nie udało się uruchomić lokalnej bazy.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshEvents() {
    const [loadedEvents, loadedIssues, loadedAvailability] = await Promise.all([listEvents(), listCalendarConsistencyIssues(), refreshAllAvailabilityPlanStatuses()]);
    setEvents(loadedEvents);
    setConsistencyIssues(loadedIssues);
    setAvailabilityPlans(loadedAvailability);
    setCoworkersByEvent(await loadCoworkerMap(loadedEvents));
    await rebuildAndSyncNotifications();
  }

  async function openEventEditor(event: CalendarEvent) {
    const workCoworkers = event.source === 'WORK_PDF' ? await listCoworkersForWorkEvent(event.id) : [];
    setEventEditor({ event, ...(workCoworkers.length ? { workCoworkers } : {}) });
  }

  function openSearchEvent(event: CalendarEvent) {
    setSearchOpen(false);
    void openEventEditor(event);
  }

  function openSearchLocation(location: Location) {
    setSearchOpen(false);
    setLocationEditor({ location });
  }

  async function refreshAllData() {
    const [loadedEvents, loadedLocations, loadedSettings, loadedConstraints, loadedAttributes, loadedIssues, loadedAvailability] = await Promise.all([listEvents(), listLocations(), getSettings(), listDayConstraints(), listDayAttributes(), listCalendarConsistencyIssues(), refreshAllAvailabilityPlanStatuses()]);
    setEvents(loadedEvents);
    setLocations(loadedLocations);
    setSettings(loadedSettings);
    setDayConstraints(loadedConstraints);
    setDayAttributes(loadedAttributes);
    setConsistencyIssues(loadedIssues);
    setAvailabilityPlans(loadedAvailability);
    setCoworkersByEvent(await loadCoworkerMap(loadedEvents));
    await rebuildAndSyncNotifications();
  }

  async function showUndoToast(message: string) {
    const latest = await getLatestReversibleChange();
    setToast({ message, ...(latest ? { undoJournalId: latest.id } : {}) });
  }

  async function undoToastChange(id: string) {
    try {
      await undoChange(id);
      await refreshAllData();
      setToast({ message: 'Cofnięto ostatnią zmianę.' });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Nie udało się cofnąć zmiany.' });
    }
  }

  async function toggleWorkAvailabilityExclusion(date: string, excluded: boolean) {
    await setWorkAvailabilityExcluded(date, excluded);
    setDayConstraints(await listDayConstraints());
    await showUndoToast(excluded ? 'Dzień nie będzie brany pod uwagę przy przyszłej dyspozycyjności.' : 'Dzień znów może być brany pod uwagę przy przyszłej dyspozycyjności.');
  }

  async function toggleTradingSunday(date: string, active: boolean) {
    await setTradingSunday(date, active);
    setDayAttributes(await listDayAttributes());
    await showUndoToast(active ? 'Oznaczono niedzielę handlową.' : 'Usunięto oznaczenie niedzieli handlowej.');
  }

  async function acknowledgeIssue(issue: CalendarConsistencyIssue) {
    await acknowledgeConsistencyIssue(issue);
    setConsistencyIssues(await listCalendarConsistencyIssues());
    await showUndoToast('Niespójność pozostawiono bez zmian.');
  }

  async function applyStudySeriesTiming(input: Parameters<typeof updateStudySeriesTiming>[1]) {
    if (!studySeriesTimingEvent) return;
    const updated = await updateStudySeriesTiming(studySeriesTimingEvent.id, input);
    await refreshAllData();
    setStudySeriesTimingEvent(null);
    await showUndoToast(`Skorygowano godziny ${updated.length} powiązanych zajęć.`);
  }

  function openConsistencyCenter() {
    setView('calendar');
    window.setTimeout(() => document.getElementById('consistency-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  async function refreshLocationsAndSettings() {
    const [loadedLocations, loadedSettings] = await Promise.all([listLocations(), getSettings()]);
    setLocations(loadedLocations);
    setSettings(loadedSettings);
  }

  async function saveEvent(draft: EventDraft, options?: EventSubmitOptions) {
    if (eventEditor?.event) {
      const current = eventEditor.event;
      if (current.seriesType === 'MANUAL_MULTI_DATE' && current.seriesId && options?.editScope === 'SERIES') {
        const updated = await updateManualEventSeries(current.id, draft);
        await showUndoToast(`Zaktualizowano ${updated.length} wydarzeń w serii.`);
      } else {
        await updateEvent(current.id, draft);
        await showUndoToast('Zapisano zmiany wydarzenia.');
      }
    } else if (options?.selectedDates && options.selectedDates.length > 1) {
      const startTime = draft.startDateTime.slice(11, 16);
      const endTime = draft.endDateTime.slice(11, 16);
      const seriesDraft: ManualMultiDateDraft = {
        title: draft.title,
        dates: options.selectedDates,
        startTime,
        endTime,
        allDay: draft.allDay ?? false,
        category: draft.category,
        ...(draft.description ? { description: draft.description } : {}),
        ...(draft.locationId ? { locationId: draft.locationId } : {}),
      };
      const created = await createManualEventSeries(seriesDraft);
      await showUndoToast(`Dodano serię obejmującą ${created.length} dni.`);
    } else {
      await createEvent(draft);
      await showUndoToast(draft.spanType === 'MULTI_DAY' ? 'Dodano wydarzenie wielodniowe.' : 'Dodano wydarzenie.');
    }
    await refreshEvents();
    setEventEditor(null);
  }

  async function removeEvent(scope: EventEditScope = 'SINGLE') {
    if (!eventEditor?.event) return;
    const current = eventEditor.event;
    if (scope === 'SERIES' && current.seriesId && current.seriesType === 'MANUAL_MULTI_DATE') {
      const count = await deleteManualEventSeries(current.seriesId);
      await showUndoToast(`Przeniesiono ${count} wydarzeń serii do Kosza.`);
    } else {
      await deleteEvent(current.id);
      await showUndoToast('Przeniesiono wydarzenie do Kosza.');
    }
    await refreshEvents();
    setEventEditor(null);
  }

  async function saveLocation(draft: LocationDraft) {
    if (locationEditor?.location) await updateLocation(locationEditor.location.id, draft);
    else await createLocation(draft);
    await refreshLocationsAndSettings();
    setLocationEditor(null);
    setToast({ message: locationEditor?.location ? 'Zapisano zmiany miejsca.' : 'Dodano miejsce.' });
  }

  async function removeLocation() {
    if (!locationEditor?.location) return;
    const removedId = locationEditor.location.id;
    await deleteLocation(removedId);
    const affected = events.filter((event) => event.locationId === removedId);
    if (affected.length) {
      for (const event of affected) {
        const draft: EventDraft = {
          title: event.title,
          startDateTime: event.startDateTime,
          endDateTime: event.endDateTime,
          allDay: event.allDay,
          spanType: event.spanType,
          category: event.category,
          ...(event.description ? { description: event.description } : {}),
        };
        await updateEvent(event.id, draft);
      }
      await refreshEvents();
    }
    await refreshLocationsAndSettings();
    setLocationEditor(null);
    setToast({ message: 'Usunięto miejsce.' });
  }

  async function changeSettings(patch: AppSettingsPatch) {
    const next = await updateSettings(patch);
    setSettings(next);
    if (patch.notificationPreferences) await rebuildAndSyncNotifications();
    setToast({ message: 'Ustawienia zapisane lokalnie.' });
  }

  if (loading) {
    return (
      <main className="startup-screen">
        <div className="startup-card">
          <div className="startup-mark">IK</div>
          <h1>Inteligentny Kalendarz</h1>
          <p>Uruchamiam lokalną bazę danych...</p>
        </div>
      </main>
    );
  }

  if (fatalError || !settings) {
    return (
      <main className="startup-screen">
        <div className="startup-card error-card">
          <div className="startup-mark">!</div>
          <h1>Nie udało się uruchomić aplikacji</h1>
          <p>{fatalError || 'Brak ustawień aplikacji.'}</p>
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>Spróbuj ponownie</button>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell" data-floral-mode={settings.decorativeBackgroundMode}>
      <AppBackgroundDecor mode={settings.decorativeBackgroundMode} />
      <Navigation activeView={view} onChange={setView} />
      <main className="app-main">
        <FloralAccent variant="flourish" className="view-floral-accent" />
        <div className="global-search-utility">
          <button type="button" className="global-search-trigger" onClick={() => setSearchOpen(true)}>
            <AppIcon name="search" size={18} />
            <span>Szukaj</span>
          </button>
        </div>
        {view === 'today' ? (
          <TodayView events={events} locations={locations} timeFormat={settings.timeFormat} consistencyIssues={consistencyIssues} onOpenConsistencyCenter={openConsistencyCenter} onAdd={(date) => setEventEditor(date ? { initialDate: date } : {})} onEdit={(event) => { void openEventEditor(event); }} onStudyCorrect={setStudyCorrectionEvent} availabilityPlans={availabilityPlans} coworkersByEvent={coworkersByEvent} />
        ) : null}
        {view === 'calendar' ? (
          <CalendarView events={events} locations={locations} timeFormat={settings.timeFormat} dayConstraints={dayConstraints} dayAttributes={dayAttributes} consistencyIssues={consistencyIssues} onToggleWorkAvailabilityExclusion={toggleWorkAvailabilityExclusion} onToggleTradingSunday={toggleTradingSunday} onAcknowledgeConsistency={acknowledgeIssue} onStudySeriesCorrect={setStudySeriesTimingEvent} onAdd={(date) => setEventEditor(date ? { initialDate: date } : {})} onAddMany={(dates) => setEventEditor({ initialDates: dates })} onEdit={(event) => { void openEventEditor(event); }} onStudyCorrect={setStudyCorrectionEvent} availabilityPlans={availabilityPlans} coworkersByEvent={coworkersByEvent} onOpenAvailability={(date, blockId) => setAvailabilityEditor({ date, ...(blockId ? { blockId } : {}) })} />
        ) : null}
        {view === 'study' ? (
          <StudyView onDataChanged={refreshAllData} />
        ) : null}
        {view === 'work' ? (
          <WorkView locations={locations} onDataChanged={refreshAllData} />
        ) : null}
        {view === 'shopping' ? (
          <ShoppingView />
        ) : null}
        {view === 'cycle' ? (
          <CycleView onDataChanged={refreshAllData} onProtectData={() => { setView('settings'); window.setTimeout(() => document.getElementById('data-transfer-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }} />
        ) : null}
        {view === 'locations' ? (
          <LocationsView locations={locations} homeLocationId={settings.homeLocationId} workLocationId={settings.workLocationId} onAdd={() => setLocationEditor({})} onEdit={(location) => setLocationEditor({ location })} />
        ) : null}
        {view === 'settings' ? (
          <SettingsView settings={settings} locations={locations} onChange={changeSettings} onDataChanged={refreshAllData} />
        ) : null}
      </main>

      {searchOpen ? (
        <GlobalSearch
          events={events}
          locations={locations}
          onOpenEvent={openSearchEvent}
          onOpenLocation={openSearchLocation}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}

      {eventEditor ? (
        <Modal title={eventEditor.event ? 'Edytuj wydarzenie' : eventEditor.initialDates?.length ? 'Nowe wydarzenie w kilku dniach' : 'Nowe wydarzenie'} onClose={() => setEventEditor(null)} wide>
          <EventForm
            event={eventEditor.event}
            locations={locations}
            initialDate={eventEditor.initialDate}
            initialDates={eventEditor.initialDates}
            onSubmit={saveEvent}
            workCoworkers={eventEditor.workCoworkers}
            onDelete={eventEditor.event ? removeEvent : undefined}
            onCancel={() => setEventEditor(null)}
          />
        </Modal>
      ) : null}


      {studyCorrectionEvent ? (
        <Modal title="Uzupełnij dane zajęcia" onClose={() => setStudyCorrectionEvent(null)} wide>
          <StudyEventCorrection
            event={studyCorrectionEvent}
            onSaved={async (count) => {
              await refreshAllData();
              setStudyCorrectionEvent(null);
              await showUndoToast(count > 1 ? `Zaktualizowano ${count} powiązanych wydarzeń.` : 'Uzupełniono dane wydarzenia.');
            }}
            onCancel={() => setStudyCorrectionEvent(null)}
          />
        </Modal>
      ) : null}

      {studySeriesTimingEvent ? (
        <Modal title="Popraw godziny powiązanej serii" onClose={() => setStudySeriesTimingEvent(null)} wide>
          <StudySeriesTimingCorrection event={studySeriesTimingEvent} events={events} onApply={applyStudySeriesTiming} onCancel={() => setStudySeriesTimingEvent(null)} />
        </Modal>
      ) : null}

      {availabilityEditor ? (
        <Modal title="Dyspozycyjność" onClose={() => setAvailabilityEditor(null)}>
          <DayAvailabilityEditor date={availabilityEditor.date} {...(availabilityEditor.blockId ? { blockId: availabilityEditor.blockId } : {})} onSaved={refreshAllData} onClose={() => setAvailabilityEditor(null)} />
        </Modal>
      ) : null}

      {locationEditor ? (
        <Modal title={locationEditor.location ? 'Edytuj miejsce' : 'Nowe miejsce'} onClose={() => setLocationEditor(null)}>
          <LocationForm
            location={locationEditor.location}
            onSubmit={saveLocation}
            onDelete={locationEditor.location ? removeLocation : undefined}
            onCancel={() => setLocationEditor(null)}
          />
        </Modal>
      ) : null}

      {toast ? <div className="toast toast-with-action" role="status"><span>{toast.message}</span>{toast.undoJournalId ? <button type="button" onClick={() => void undoToastChange(toast.undoJournalId!)}>Cofnij</button> : null}</div> : null}

      <div className="floating-context" aria-hidden="true">
        <span>{locationById.get(settings.homeLocationId ?? '')?.name ?? 'Brak obszaru startowego'}</span>
        <i />
        <span>{locationById.get(settings.workLocationId ?? '')?.name ?? 'Brak miejsca pracy'}</span>
      </div>
    </div>
  );
}
