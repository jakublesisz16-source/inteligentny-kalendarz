import { useEffect, useMemo, useRef, useState } from 'react';
import type { AvailabilityPlan } from '../availability/availability.types';
import { AvailabilityView } from '../availability/AvailabilityView';
import type { CalendarEvent } from '../events/event.types';
import { readPdfSnapshot } from '../imports/pdf/pdf-reader';
import { validateWorkPdfFile } from '../imports/pdf/work-pdf-file';
import { parseWorkScheduleDocument } from '../imports/pdf/work-adapter-registry';
import type { Location } from '../locations/location.types';
import { PlanningSettings } from '../planning/PlanningSettings';
import type { PlanningSettingsHandle } from '../planning/PlanningSettings';
import {
  commitWorkScheduleImport,
  deleteWorkScheduleImport,
  findWorkScheduleImportByHash,
  getActiveWorkScheduleImport,
  getConfirmedWorkMinutes,
  getWorkProfile,
  listAvailabilityPlans,
  listCoworkersForWorkEvents,
  listEvents,
  listWorkScheduleEntries,
  listWorkScheduleImports,
} from '../storage/database';
import { Modal } from '../ui/Modal';
import { AvailabilityWorkComparisonPanel } from './AvailabilityWorkComparisonPanel';
import { CoworkerOverlapList } from './CoworkerOverlapList';
import { WorkProfileEditor } from './WorkProfileEditor';
import type { WorkProfileEditorHandle } from './WorkProfileEditor';
import { WorkSummaryView } from './WorkSummaryView';
import { buildWorkScheduleDiff, candidatesFromEmployee, coworkerDrafts, detectCandidateCollisions, employeeForProfile, formatPersonCount, formatWorkMinutes, sortCoworkerOverlaps } from './work.service';
import type { CoworkerOverlap, WorkCollision, WorkImportCandidate, WorkProfile, WorkScheduleDiff, WorkScheduleImport, WorkScheduleParseResult } from './work.types';
import { getWorkImportReadiness } from './work-import-readiness';
import { sha256Hex } from '../core/sha256';

interface WorkViewProps {
  locations: Location[];
  onDataChanged: () => Promise<void>;
}

interface AnalysisState {
  fileName: string;
  fileHash: string;
  result: WorkScheduleParseResult;
  targetName: string;
  candidates: WorkImportCandidate[];
  coworkers: ReturnType<typeof coworkerDrafts>;
  collisions: WorkCollision[];
  diff?: WorkScheduleDiff;
  activeImport?: WorkScheduleImport;
  sourceReportedMinutes?: number;
}

function formatPeriod(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(date);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
}

export function WorkView({ locations, onDataChanged }: WorkViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const workProfileSettingsRef = useRef<WorkProfileEditorHandle>(null);
  const planningSettingsRef = useRef<PlanningSettingsHandle>(null);
  const [profile, setProfile] = useState<WorkProfile | undefined>(undefined);
  const [imports, setImports] = useState<WorkScheduleImport[]>([]);
  const [workEvents, setWorkEvents] = useState<CalendarEvent[]>([]);
  const [confirmedWorkEvents, setConfirmedWorkEvents] = useState<CalendarEvent[]>([]);
  const [availabilityPlans, setAvailabilityPlans] = useState<AvailabilityPlan[]>([]);
  const [coworkersByEvent, setCoworkersByEvent] = useState<Record<string, CoworkerOverlap[]>>({});
  const [summary, setSummary] = useState({ importedWorkMinutes: 0, manualWorkMinutes: 0, totalConfirmedWorkMinutes: 0 });
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [conflictDecision, setConflictDecision] = useState<'PRESERVE_USER' | 'USE_NEW'>('PRESERVE_USER');
  const [workTab, setWorkTab] = useState<'schedule' | 'availability' | 'summary'>('schedule');
  const [comparisonDetailsRequest, setComparisonDetailsRequest] = useState(0);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    const [currentProfile, currentImports, events, plans] = await Promise.all([getWorkProfile(), listWorkScheduleImports(), listEvents(), listAvailabilityPlans()]);
    setProfile(currentProfile);
    setImports(currentImports);
    setAvailabilityPlans(plans);
    const pdfEvents = events.filter((event) => event.source === 'WORK_PDF');
    setWorkEvents(pdfEvents);
    setConfirmedWorkEvents(events.filter((event) => event.category === 'WORK' && !event.allDay && (event.source === 'MANUAL' || event.source === 'WORK_PDF')));
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate).padStart(2, '0')}`;
    setSummary(await getConfirmedWorkMinutes(monthStart, monthEnd));
    setCoworkersByEvent(await listCoworkersForWorkEvents(pdfEvents));
  }

  const activeImports = imports.filter((item) => item.lifecycleStatus === 'ACTIVE').sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  const latestActive = activeImports[0];
  const activeWorkEvents = useMemo(() => latestActive ? workEvents.filter((event) => !event.sourceWorkImportId || event.sourceWorkImportId === latestActive.id) : workEvents, [latestActive, workEvents]);
  const nearestEvent = useMemo(() => activeWorkEvents.filter((event) => Date.parse(event.endDateTime) >= Date.now()).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))[0], [activeWorkEvents]);
  const nearestCoworkers = useMemo(() => nearestEvent ? sortCoworkerOverlaps(coworkersByEvent[nearestEvent.id] ?? []) : [], [coworkersByEvent, nearestEvent]);
  const currentMonthShiftCount = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return activeWorkEvents.filter((event) => event.startDateTime.startsWith(prefix)).length;
  }, [activeWorkEvents]);
  const hasSentAvailability = useMemo(() => availabilityPlans.some((plan) => plan.sentSnapshots.length > 0), [availabilityPlans]);

  async function analyzeFile(file: File) {
    setError(''); setMessage(''); setAnalysis(null); setAnalyzing(true);
    try {
      await validateWorkPdfFile(file);
      const currentProfile = await getWorkProfile();
      if (!currentProfile?.employeeMatchName.trim()) throw new Error('Najpierw ustaw profil pracy i imię/nazwisko używane w grafiku.');
      const buffer = await file.arrayBuffer();
      const fileHash = await sha256Hex(buffer);
      if (await findWorkScheduleImportByHash(fileHash)) throw new Error('Ten grafik został już zaimportowany.');
      const snapshot = await readPdfSnapshot(buffer);
      if (!snapshot.fullText.trim()) throw new Error('Nie udało się odczytać tekstu z tego PDF. Ta wersja obsługuje grafiki z warstwą tekstową.');
      const result = parseWorkScheduleDocument(snapshot);
      const target = employeeForProfile(result.employees, currentProfile.employeeMatchName);
      if (!target) throw new Error('Nie znaleziono Twojego profilu w grafiku. Sprawdź zapis imienia i nazwiska w profilu pracy.');
      const candidates = candidatesFromEmployee(currentProfile.id, target);
      if (!candidates.length) throw new Error('Znaleziono profil pracownika, ale nie znaleziono żadnej zmiany w tym okresie.');
      const activeImport = await getActiveWorkScheduleImport(result.periodStart, currentProfile.id);
      const allEvents = await listEvents();
      const collisions = detectCandidateCollisions(candidates, allEvents, activeImport?.id);
      let diff: WorkScheduleDiff | undefined;
      if (activeImport) {
        const oldEntries = await listWorkScheduleEntries(activeImport.id);
        diff = buildWorkScheduleDiff(oldEntries, candidates, new Map(allEvents.map((event) => [event.id, event])));
      }
      setAnalysis({
        fileName: file.name, fileHash, result, targetName: target.displayName, candidates,
        coworkers: currentProfile.storeCoworkerSchedule ? coworkerDrafts(result.employees, target.displayName) : [], collisions,
        ...(diff ? { diff } : {}), ...(activeImport ? { activeImport } : {}),
        ...(target.sourceReportedMinutes !== undefined ? { sourceReportedMinutes: target.sourceReportedMinutes } : {}),
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Nie udało się przeanalizować PDF.'); }
    finally { setAnalyzing(false); if (inputRef.current) inputRef.current.value = ''; }
  }

  async function commit() {
    if (!analysis || !profile) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await commitWorkScheduleImport({
        profileId: profile.id, fileName: analysis.fileName, fileHash: analysis.fileHash, adapterId: analysis.result.adapterId,
        periodStart: analysis.result.periodStart, periodEnd: analysis.result.periodEnd, shifts: analysis.candidates, coworkerShifts: analysis.coworkers,
        conflictDecision, ...(analysis.sourceReportedMinutes !== undefined ? { sourceReportedMinutes: analysis.sourceReportedMinutes } : {}),
      });
      setMessage(`Grafik zapisany. ${result.workImport.shiftCount} zmian, ${formatWorkMinutes(result.workImport.totalMinutes)}.`);
      setAnalysis(null); await Promise.all([refresh(), onDataChanged()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać grafiku.'); }
    finally { setSaving(false); }
  }

  async function removeImport(item: WorkScheduleImport) {
    if (!window.confirm(`Usunąć grafik ${formatPeriod(item.periodStart)}? Ręczne wydarzenia pracy pozostaną.`)) return;
    try {
      await deleteWorkScheduleImport(item.id); setMessage('Grafik usunięto. Utworzono punkt przywracania.');
      await Promise.all([refresh(), onDataChanged()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Nie udało się usunąć grafiku.'); }
  }

  const sourceSum = analysis?.sourceReportedMinutes;
  const parsedSum = analysis?.candidates.reduce((sumValue, item) => sumValue + item.minutes, 0) ?? 0;
  const workHeaderTitle = workTab === 'schedule' ? 'Grafik' : workTab === 'availability' ? 'Dyspozycyjność' : 'Podsumowanie';
  const workHeaderSubtitle = workTab === 'schedule'
    ? 'Zmiany, godziny i zespół w jednym miejscu.'
    : workTab === 'availability'
      ? 'Wpisz godziny, które możesz wysłać, lub skorzystaj z opcjonalnego automatu.'
      : 'Miesięczne godziny, zmiany i zgodność z wysłaną dyspozycyjnością.';
  const importReadiness = getWorkImportReadiness(profile);
  const workProfileReady = importReadiness.ready;


  async function saveWorkSettings(closeAfterSave = false): Promise<boolean> {
    setSettingsSaving(true);
    setSettingsMessage('');
    try {
      const savedProfile = await workProfileSettingsRef.current?.save();
      if (!savedProfile) return false;
      const savedAutomation = await planningSettingsRef.current?.save();
      if (!savedAutomation) return false;
      setProfile(savedProfile);
      if (closeAfterSave) {
        setSettingsOpen(false);
        setMessage('Ustawienia pracy zapisane.');
      } else {
        setSettingsMessage('Ustawienia pracy zapisane.');
      }
      return true;
    } finally {
      setSettingsSaving(false);
    }
  }

  function requestPdfImport() {
    if (!workProfileReady) {
      setMessage(profile ? 'Uzupełnij imię i nazwisko tak, jak występuje w grafiku PDF.' : 'Najpierw ustaw profil pracy, aby aplikacja wiedziała, która osoba w grafiku to Ty.');
      setSettingsOpen(true);
      return;
    }
    inputRef.current?.click();
  }

  return (
    <section className="view-shell work-view">
      <header className="view-header work-minimal-header"><div><p className="eyebrow">Praca</p><h1>{workHeaderTitle}</h1><p className="view-subtitle">{workHeaderSubtitle}</p></div><div className="work-header-actions"><button type="button" className="button button-secondary button-small work-settings-button" onClick={() => setSettingsOpen(true)} aria-label="Ustawienia pracy"><span aria-hidden="true">⚙</span><span className="work-settings-button-label">Ustawienia</span></button>{workTab === 'schedule' ? workProfileReady ? <button type="button" className={`button ${activeWorkEvents.length ? 'button-secondary' : 'button-primary'} work-import-button`} onClick={requestPdfImport} disabled={analyzing}>{analyzing ? 'Analizuję...' : activeWorkEvents.length ? 'Aktualizuj PDF' : 'Importuj PDF'}</button> : <button type="button" className="button button-primary" onClick={() => setSettingsOpen(true)}>{importReadiness.actionLabel}</button> : null}</div></header>
      <div className="work-section-tabs" role="tablist" aria-label="Praca"><button type="button" role="tab" aria-selected={workTab === 'schedule'} className={workTab === 'schedule' ? 'active' : ''} onClick={() => setWorkTab('schedule')}>Grafik</button><button type="button" role="tab" aria-selected={workTab === 'availability'} className={workTab === 'availability' ? 'active' : ''} onClick={() => setWorkTab('availability')}>Dyspozycyjność</button><button type="button" role="tab" aria-selected={workTab === 'summary'} className={workTab === 'summary' ? 'active' : ''} onClick={() => setWorkTab('summary')}>Podsumowanie</button></div>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="visually-hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeFile(file); }} />
      {workTab === 'schedule' && !workProfileReady ? <section className="work-action-guidance" aria-label="Wymaganie przed importem grafiku"><div><strong>{importReadiness.reason === 'MISSING_EMPLOYEE_NAME' ? 'Uzupełnij profil pracy' : 'Najpierw ustaw profil pracy'}</strong><span>{importReadiness.reason === 'MISSING_EMPLOYEE_NAME' ? 'Wpisz imię i nazwisko dokładnie tak, jak występuje w grafiku PDF.' : 'Aplikacja potrzebuje Twojego imienia i nazwiska z grafiku, aby rozpoznać właściwe zmiany.'}</span></div><button type="button" className="button button-secondary button-small" onClick={() => setSettingsOpen(true)}>{importReadiness.actionLabel}</button></section> : null}
      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}

      {workTab === 'availability' ? <AvailabilityView onDataChanged={async () => { await Promise.all([refresh(), onDataChanged()]); }} onOpenSettings={() => setSettingsOpen(true)} /> : workTab === 'summary' ? <WorkSummaryView workEvents={confirmedWorkEvents} workImports={imports} availabilityPlans={availabilityPlans} onImportClick={requestPdfImport} onOpenComparison={() => { setComparisonDetailsRequest((value) => value + 1); setWorkTab('schedule'); }} onOpenAvailability={() => setWorkTab('availability')} initialMonth={latestActive?.periodStart.slice(0, 7)} /> : <>
        <section className="work-summary-line" aria-label="Praca w tym miesiącu"><strong>{formatWorkMinutes(summary.totalConfirmedWorkMinutes)}</strong><span>{currentMonthShiftCount} {currentMonthShiftCount === 1 ? 'zmiana' : 'zmian'}</span><span>{latestActive ? formatPeriod(latestActive.periodStart) : 'Brak aktywnego grafiku'}</span></section>

        {analysis ? <section className="panel work-analysis-card"><div className="panel-heading"><div><p className="section-kicker">Podgląd przed zapisem</p><h2>{analysis.activeImport ? 'Aktualizacja grafiku' : 'Nowy grafik'} - {formatPeriod(analysis.result.periodStart)}</h2></div><button type="button" className="text-button" onClick={() => setAnalysis(null)}>Anuluj</button></div>
          <div className="work-analysis-primary-action"><button type="button" className="button button-primary" onClick={() => void commit()} disabled={saving}>{saving ? 'Zapisywanie...' : analysis.activeImport ? 'Zastosuj aktualizację' : 'Dodaj do kalendarza'}</button><span>{analysis.activeImport ? 'Zapisze zmiany w aktywnym grafiku.' : `${analysis.candidates.length} zmian · ${formatWorkMinutes(parsedSum)}`}</span></div>
          <div className="work-analysis-metrics work-analysis-metrics-essential"><div><span>Profil</span><strong>{analysis.targetName}</strong></div><div><span>Zmiany</span><strong>{analysis.candidates.length}</strong></div><div><span>Godziny</span><strong>{formatWorkMinutes(parsedSum)}</strong></div></div>
          {sourceSum !== undefined && sourceSum !== parsedSum ? <div className="study-message error-message">PDF podaje {formatWorkMinutes(sourceSum)}, a parser policzył {formatWorkMinutes(parsedSum)}. Sprawdź grafik przed zatwierdzeniem.</div> : null}
          {analysis.diff ? <div className="work-diff-summary"><strong>Co zmienił nowy grafik?</strong><span>+ {analysis.diff.summary.added} nowych</span><span>- {analysis.diff.summary.removed} usuniętych</span><span>~ {analysis.diff.summary.changed} zmienionych</span><span>! {analysis.diff.summary.conflicts} konfliktów</span><span>= {analysis.diff.summary.unchanged} bez zmian</span></div> : null}
          {analysis.diff?.summary.conflicts ? <fieldset className="series-scope-picker"><legend>Konflikty z ręcznymi zmianami</legend><label><input type="radio" checked={conflictDecision === 'PRESERVE_USER'} onChange={() => setConflictDecision('PRESERVE_USER')} /><span>Zachowaj moje ręczne zmiany</span></label><label><input type="radio" checked={conflictDecision === 'USE_NEW'} onChange={() => setConflictDecision('USE_NEW')} /><span>Użyj danych z nowego grafiku</span></label></fieldset> : null}
          <details className="work-analysis-details"><summary>Sprawdź szczegóły importu</summary><div className="work-analysis-details-meta"><span>PDF: <strong>{sourceSum !== undefined ? formatWorkMinutes(sourceSum) : 'brak sumy'}</strong></span><span>Kolizje: <strong>{analysis.collisions.filter((item) => item.kind === 'OVERLAP').length}</strong></span><span>Zespół: <strong>{analysis.coworkers.length ? formatPersonCount(new Set(analysis.coworkers.map((item) => item.normalizedName)).size) : 'wyłączony'}</strong></span></div>
            {analysis.collisions.length ? <div className="work-collision-list"><strong>Kolizje i brak buforu</strong>{analysis.collisions.slice(0, 12).map((collision, index) => <div key={`${collision.eventId}-${collision.candidate.date}-${index}`} className={`work-collision ${collision.kind.toLowerCase()}`}><span>{formatDate(collision.candidate.date)} {collision.candidate.startTime}-{collision.candidate.endTime}</span><span>{collision.kind === 'OVERLAP' ? 'KOLIZJA' : collision.kind === 'TOUCHING' ? 'BRAK BUFORU' : 'MOŻLIWY DUPLIKAT'} - {collision.eventTitle}</span></div>)}</div> : null}
            <div className="work-shift-preview"><strong>Zmiany z PDF</strong>{analysis.candidates.map((shift) => <div key={shift.workOccurrenceKey}><span>{formatDate(shift.date)}</span><strong>{shift.startTime}-{shift.endTime}</strong><span>{formatWorkMinutes(shift.minutes)}</span></div>)}</div>
          </details>
        </section> : null}

        <div className="work-overview-simple">
          <section className="work-next-strip" aria-label="Najbliższa zmiana">
            <div><span>Najbliższa zmiana</span><strong>{nearestEvent ? `${formatDate(nearestEvent.startDateTime.slice(0,10))}, ${nearestEvent.startDateTime.slice(11,16)}-${nearestEvent.endDateTime.slice(11,16)}` : 'Brak nadchodzącej zmiany'}</strong>{nearestEvent ? <small>{locations.find((location) => location.id === nearestEvent.locationId)?.name ?? profile?.workplaceName ?? 'Praca'}</small> : null}</div>
            {nearestEvent && nearestCoworkers.length ? <div className="work-next-team-static"><span className="work-next-team-count">{formatPersonCount(nearestCoworkers.length)} razem</span><div className="coworker-inline">{nearestCoworkers.map((person) => <span key={`${person.displayName}-${person.coworkerStartTime}-${person.coworkerEndTime}`}>{person.displayName}</span>)}</div></div> : null}
          </section>
          {hasSentAvailability ? <AvailabilityWorkComparisonPanel plans={availabilityPlans} workEvents={workEvents} workImports={imports} onImportClick={requestPdfImport} onOpenAvailability={() => setWorkTab('availability')} openDetailsRequest={comparisonDetailsRequest} /> : null}
        </div>

        {activeWorkEvents.length ? <section className="work-roster-list work-roster-minimal"><div className="work-roster-minimal-heading"><h2>Grafik</h2><span>{activeWorkEvents.length} {activeWorkEvents.length === 1 ? 'zmiana' : 'zmian'}{latestActive ? ` · ${formatWorkMinutes(latestActive.totalMinutes)}` : ''}</span></div><div className="work-shift-list work-shift-list-minimal">{[...activeWorkEvents].sort((a,b)=>a.startDateTime.localeCompare(b.startDateTime)).map((event) => { const coworkers = coworkersByEvent[event.id] ?? []; const ownMinutes = Math.max(0, Math.round((Date.parse(event.endDateTime) - Date.parse(event.startDateTime)) / 60000)); return <article key={event.id} className="work-shift-row-minimal"><div className="work-shift-main-line"><strong>{formatDate(event.startDateTime.slice(0,10))}</strong><span>{event.startDateTime.slice(11,16)}-{event.endDateTime.slice(11,16)}</span><small>{formatWorkMinutes(ownMinutes)}</small></div>{coworkers.length ? <details className="work-shift-team-details"><summary>{formatPersonCount(coworkers.length)} na zmianie</summary><CoworkerOverlapList people={coworkers} compact /></details> : null}</article>; })}</div></section> : null}

        {imports.length ? <details className="panel work-history work-history-details"><summary>Historia importów ({imports.length})</summary><div className="import-history-grid">{imports.map((item) => <article key={item.id} className="import-history-card"><div><strong>{formatPeriod(item.periodStart)}</strong><span className="status-pill">{item.lifecycleStatus === 'ACTIVE' ? 'AKTYWNY' : item.lifecycleStatus === 'HISTORICAL' ? 'HISTORYCZNY' : 'USUNIĘTY'}</span></div><p>{item.fileName}</p><small>{item.shiftCount} zmian - {formatWorkMinutes(item.totalMinutes)}</small>{item.lifecycleStatus !== 'DELETED' ? <button type="button" className="text-button warning-text" onClick={() => void removeImport(item)}>Usuń import</button> : null}</article>)}</div></details> : null}
      </>}

      {settingsOpen ? <Modal title="Ustawienia pracy" headerActions={<button type="button" className="button button-primary button-small work-settings-header-save" disabled={settingsSaving} onClick={() => void saveWorkSettings(true)}>{settingsSaving ? 'Zapisuję...' : 'Zapisz'}</button>} onClose={() => { setSettingsOpen(false); setSettingsMessage(''); }} wide><div className="work-settings-modal"><section><div className="panel-heading compact-heading"><div><span className="section-kicker">Miejsce pracy</span><h3>Profil grafiku</h3></div></div><WorkProfileEditor ref={workProfileSettingsRef} locations={locations} compact hideSubmit silentSuccess onSaved={async (saved) => { setProfile(saved); }} /></section><section className="work-settings-divider"><PlanningSettings ref={planningSettingsRef} hideSaveButton silentSuccess onDataChanged={async () => { await Promise.all([refresh(), onDataChanged()]); }} /></section>{settingsMessage ? <div className="study-message success-message" role="status">{settingsMessage}</div> : null}<div className="work-settings-save-footer"><button type="button" className="button button-primary" disabled={settingsSaving} onClick={() => void saveWorkSettings()}>{settingsSaving ? 'Zapisywanie...' : 'Zapisz ustawienia pracy'}</button><span>Profil grafiku i ustawienia automatu zapiszesz jednym przyciskiem.</span></div></div></Modal> : null}
    </section>
  );
}
