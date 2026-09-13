import { useEffect, useState } from 'react';
import type { AppView } from './app.types';
import { Navigation } from '../ui/Navigation';
import { Modal } from '../ui/Modal';
import { AppSplash } from '../ui/AppSplash';
import { GlobalSearch } from '../search/GlobalSearch';
import { TodayView } from '../calendar/TodayView';
import { CalendarView } from '../calendar/CalendarView';
import { SettingsView } from '../settings/SettingsView';
import { StudyView } from '../study/StudyView';
import { WorkView } from '../work/WorkView';
import { FinanceView } from '../finance/FinanceView';
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
import type { UniversityImportEntry, UniversityScheduleImport } from '../study/study.types';
import { groupSetsIntersect } from '../imports/xlsx/group-normalizer';
import { refreshAllAvailabilityPlanStatuses } from '../availability/availability.service';
import { DayAvailabilityEditor } from '../availability/DayAvailabilityEditor';
import { StudySeriesTimingCorrection } from '../planning/StudySeriesTimingCorrection';
import {
  createEvent,
  createManualEventSeries,
  createLocation,
  deleteEvent,
  deleteManualEventSeries,
  deleteLocation,
  getSettings,
  getActiveUniversityImport,
  listUniversityImportEntries,
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
  initialTitle?: string | undefined;
  initialEndDate?: Date | undefined;
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
  const [splashVisible, setSplashVisible] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [dayConstraints, setDayConstraints] = useState<DayConstraint[]>([]);
  const [dayAttributes, setDayAttributes] = useState<DayAttribute[]>([]);
  const [consistencyIssues, setConsistencyIssues] = useState<CalendarConsistencyIssue[]>([]);
  const [availabilityPlans, setAvailabilityPlans] = useState<AvailabilityPlan[]>([]);
  const [activeStudyGroups, setActiveStudyGroups] = useState<string[]>([]);
  const [incompleteStudyEntries, setIncompleteStudyEntries] = useState<UniversityImportEntry[]>([]);
  const [coworkersByEvent, setCoworkersByEvent] = useState<Record<string, CoworkerOverlap[]>>({});
  const [view, setView] = useState<AppView>('today');
  const [eventEditor, setEventEditor] = useState<EventEditorState | null>(null);
  const [locationEditor, setLocationEditor] = useState<LocationEditorState | null>(null);
  const [studyCorrectionEvent, setStudyCorrectionEvent] = useState<CalendarEvent | null>(null);
  const [studySeriesTimingEvent, setStudySeriesTimingEvent] = useState<CalendarEvent | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [availabilityEditor, setAvailabilityEditor] = useState<{ date: string; blockId?: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);


  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setSearchOpen(true);
    }
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
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

  async function loadIncompleteStudyEntries(activeImport: UniversityScheduleImport | undefined): Promise<UniversityImportEntry[]> {
    if (!activeImport) return [];
    const entries = await listUniversityImportEntries(activeImport.id);
    return entries.filter((entry) => {
      if (!entry.sourceOnly) return false;
      if (entry.groupScope === 'SPECIFIC' && !groupSetsIntersect(entry.groupTags, activeImport.selectedGroups)) return false;
      return !entry.date || !entry.startTime || !entry.endTime;
    });
  }

  async function bootstrap() {
    try {
      await initializeDatabase();
      const [loadedEvents, loadedLocations, loadedSettings, loadedConstraints, loadedAttributes, loadedIssues, loadedAvailability, activeStudyImport] = await Promise.all([
        listEvents(),
        listLocations(),
        getSettings(),
        listDayConstraints(),
        listDayAttributes(),
        listCalendarConsistencyIssues(),
        refreshAllAvailabilityPlanStatuses(),
        getActiveUniversityImport(),
      ]);
      setEvents(loadedEvents);
      setLocations(loadedLocations);
      setSettings(loadedSettings);
      setDayConstraints(loadedConstraints);
      setDayAttributes(loadedAttributes);
      setConsistencyIssues(loadedIssues);
      setAvailabilityPlans(loadedAvailability);
      setActiveStudyGroups(activeStudyImport?.selectedGroups ?? []);
      setIncompleteStudyEntries(await loadIncompleteStudyEntries(activeStudyImport));
      setCoworkersByEvent(await loadCoworkerMap(loadedEvents));
      setView(loadedSettings.preferredStartView);
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
    const [loadedEvents, loadedLocations, loadedSettings, loadedConstraints, loadedAttributes, loadedIssues, loadedAvailability, activeStudyImport] = await Promise.all([listEvents(), listLocations(), getSettings(), listDayConstraints(), listDayAttributes(), listCalendarConsistencyIssues(), refreshAllAvailabilityPlanStatuses(), getActiveUniversityImport()]);
    setEvents(loadedEvents);
    setLocations(loadedLocations);
    setSettings(loadedSettings);
    setDayConstraints(loadedConstraints);
    setDayAttributes(loadedAttributes);
    setConsistencyIssues(loadedIssues);
    setAvailabilityPlans(loadedAvailability);
    setActiveStudyGroups(activeStudyImport?.selectedGroups ?? []);
    setIncompleteStudyEntries(await loadIncompleteStudyEntries(activeStudyImport));
    setCoworkersByEvent(await loadCoworkerMap(loadedEvents));
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

  async function quickEditEvent(event: CalendarEvent, draft: EventDraft) {
    await updateEvent(event.id, draft);
    await refreshEvents();
    await showUndoToast(event.seriesId ? 'Zapisano zmianę tylko tego wystąpienia.' : 'Zapisano zmiany wydarzenia.');
  }

  async function quickMoveEvent(event: CalendarEvent, draft: EventDraft) {
    if (event.source !== 'MANUAL' || event.allDay || event.spanType !== 'SINGLE_DAY' || event.seriesId) return;
    await updateEvent(event.id, draft);
    await refreshEvents();
    await showUndoToast('Przeniesiono wydarzenie.');
  }

  async function quickDeleteEvent(event: CalendarEvent) {
    if (event.source !== 'MANUAL' || event.seriesId) return;
    await deleteEvent(event.id);
    await refreshEvents();
    await showUndoToast('Przeniesiono wydarzenie do Kosza.');
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
        ...(draft.availabilityImpact ? { availabilityImpact: draft.availabilityImpact } : {}),
        ...(draft.description ? { description: draft.description } : {}),
        ...(draft.locationId ? { locationId: draft.locationId } : {}),
        ...(draft.locationText ? { locationText: draft.locationText } : {}),
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
    await refreshEvents();
    await refreshLocationsAndSettings();
    setLocationEditor(null);
    setToast({ message: 'Usunięto miejsce.' });
  }

  async function changeSettings(patch: AppSettingsPatch) {
    const next = await updateSettings(patch);
    setSettings(next);
    setToast({ message: 'Ustawienia zapisane lokalnie.' });
  }

  if (splashVisible) {
    return <AppSplash ready={!loading} onComplete={() => setSplashVisible(false)} />;
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
    <div className="app-shell">
      <Navigation activeView={view} onChange={setView} />
      <main className="app-main">
        {view === 'today' ? (
          <TodayView events={events} locations={locations} timeFormat={settings.timeFormat} showPolishHolidays={settings.showPolishHolidays !== false} showWumAcademicCalendar={settings.showWumAcademicCalendar !== false} consistencyIssues={consistencyIssues} onOpenConsistencyCenter={openConsistencyCenter} onAdd={(date) => setEventEditor(date ? { initialDate: date } : {})} onEdit={(event) => { void openEventEditor(event); }} onStudyCorrect={setStudyCorrectionEvent} availabilityPlans={availabilityPlans} coworkersByEvent={coworkersByEvent} />
        ) : null}
        {view === 'calendar' ? (
          <CalendarView events={events} locations={locations} timeFormat={settings.timeFormat} showPolishHolidays={settings.showPolishHolidays !== false} showWumAcademicCalendar={settings.showWumAcademicCalendar !== false} dayConstraints={dayConstraints} dayAttributes={dayAttributes} consistencyIssues={consistencyIssues} activeStudyGroups={activeStudyGroups} incompleteStudyEntries={incompleteStudyEntries} onToggleWorkAvailabilityExclusion={toggleWorkAvailabilityExclusion} onToggleTradingSunday={toggleTradingSunday} onAcknowledgeConsistency={acknowledgeIssue} onStudySeriesCorrect={setStudySeriesTimingEvent} onAdd={(date, initialTitle, initialEndDate) => setEventEditor(date ? { initialDate: date, ...(initialTitle ? { initialTitle } : {}), ...(initialEndDate ? { initialEndDate } : {}) } : {})} onQuickAdd={async (draft) => { await saveEvent(draft); }} onQuickEdit={quickEditEvent} onQuickMove={quickMoveEvent} onQuickDelete={quickDeleteEvent} onAddMany={(dates) => setEventEditor({ initialDates: dates })} onEdit={(event) => { void openEventEditor(event); }} onStudyCorrect={setStudyCorrectionEvent} availabilityPlans={availabilityPlans} coworkersByEvent={coworkersByEvent} onOpenAvailability={(date, blockId) => setAvailabilityEditor({ date, ...(blockId ? { blockId } : {}) })} />
        ) : null}
        {view === 'finance' ? (
          <FinanceView />
        ) : null}
        {view === 'study' ? (
          <StudyView onDataChanged={refreshAllData} />
        ) : null}
        {view === 'work' ? (
          <WorkView locations={locations} onDataChanged={refreshAllData} />
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
        <Modal
          title={eventEditor.event ? 'Edytuj wydarzenie' : eventEditor.initialDates?.length ? 'Nowe wydarzenie w kilku dniach' : 'Nowe wydarzenie'}
          onClose={() => setEventEditor(null)}
          wide
          headerActions={!eventEditor.event && !(eventEditor.initialDates && eventEditor.initialDates.length > 1) ? <button type="submit" form="event-editor-form" className="button button-primary event-mobile-header-save">Zapisz</button> : undefined}
        >
          <EventForm
            event={eventEditor.event}
            locations={locations}
            calendarEvents={events}
            initialDate={eventEditor.initialDate}
            initialTitle={eventEditor.initialTitle}
            initialEndDate={eventEditor.initialEndDate}
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

    </div>
  );
}
