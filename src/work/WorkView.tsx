import { useEffect, useMemo, useRef, useState } from 'react';
import type { AvailabilityPlan } from '../availability/availability.types';
import { AvailabilityView } from '../availability/AvailabilityView';
import type { CalendarEvent } from '../events/event.types';
import { readPdfSnapshot } from '../imports/pdf/pdf-reader';
import { parseWorkScheduleDocument } from '../imports/pdf/work-adapter-registry';
import type { Location } from '../locations/location.types';
import { PlanningSettings } from '../planning/PlanningSettings';
import {
  commitWorkScheduleImport,
  deleteWorkScheduleImport,
  findWorkScheduleImportByHash,
  getActiveWorkScheduleImport,
  getConfirmedWorkMinutes,
  getWorkProfile,
  listAvailabilityPlans,
  listCoworkersForWorkEvent,
  listEvents,
  listWorkScheduleEntries,
  listWorkScheduleImports,
} from '../storage/database';
import { Modal } from '../ui/Modal';
import { AvailabilityWorkComparisonPanel } from './AvailabilityWorkComparisonPanel';
import { CoworkerOverlapList } from './CoworkerOverlapList';
import { WorkProfileEditor } from './WorkProfileEditor';
import { WorkSummaryView } from './WorkSummaryView';
import { buildWorkScheduleDiff, candidatesFromEmployee, coworkerDrafts, detectCandidateCollisions, employeeForProfile, formatWorkMinutes } from './work.service';
import type { CoworkerOverlap, WorkCollision, WorkImportCandidate, WorkProfile, WorkScheduleDiff, WorkScheduleImport, WorkScheduleParseResult } from './work.types';
import { getWorkImportReadiness } from './work-import-readiness';

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

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
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
    const coworkerPairs = await Promise.all(pdfEvents.map(async (event) => [event.id, await listCoworkersForWorkEvent(event.id)] as const));
    setCoworkersByEvent(Object.fromEntries(coworkerPairs));
  }

  const activeImports = imports.filter((item) => item.lifecycleStatus === 'ACTIVE').sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  const latestActive = activeImports[0];
  const activeWorkEvents = useMemo(() => latestActive ? workEvents.filter((event) => !event.sourceWorkImportId || event.sourceWorkImportId === latestActive.id) : workEvents, [latestActive, workEvents]);
  const nearestEvent = useMemo(() => activeWorkEvents.filter((event) => Date.parse(event.endDateTime) >= Date.now()).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))[0], [activeWorkEvents]);
  const currentMonthShiftCount = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return activeWorkEvents.filter((event) => event.startDateTime.startsWith(prefix)).length;
  }, [activeWorkEvents]);

  async function analyzeFile(file: File) {
    setError(''); setMessage(''); setAnalysis(null); setAnalyzing(true);
    try {
      if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Wybierz plik w formacie .pdf.');
      const currentProfile = await getWorkProfile();
      if (!currentProfile?.employeeMatchName.trim()) throw new Error('Najpierw ustaw profil pracy i imię/nazwisko używane w grafiku.');
      const buffer = await file.arrayBuffer();
      const fileHash = await sha256(buffer);
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
      ? 'Szybkie wyliczenie bezpiecznych godzin pracy.'
      : 'Miesięczne godziny, zmiany i zgodność z wysłaną dyspozycyjnością.';
  const importReadiness = getWorkImportReadiness(profile);
  const workProfileReady = importReadiness.ready;

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
      <header className="view-header work-minimal-header"><div><p className="eyebrow">Praca</p><h1>{workHeaderTitle}</h1><p className="view-subtitle">{workHeaderSubtitle}</p></div><div className="work-header-actions"><button type="button" className="button button-secondary button-small" onClick={() => setSettingsOpen(true)}>⚙ Ustawienia</button>{workTab === 'schedule' ? workProfileReady ? <button type="button" className="button button-primary" onClick={requestPdfImport} disabled={analyzing}>{analyzing ? 'Analizuję...' : 'Importuj PDF'}</button> : <button type="button" className="button button-primary" onClick={() => setSettingsOpen(true)}>{importReadiness.actionLabel}</button> : null}</div></header>
      <div className="work-section-tabs" role="tablist" aria-label="Praca"><button type="button" role="tab" aria-selected={workTab === 'schedule'} className={workTab === 'schedule' ? 'active' : ''} onClick={() => setWorkTab('schedule')}>Grafik</button><button type="button" role="tab" aria-selected={workTab === 'availability'} className={workTab === 'availability' ? 'active' : ''} onClick={() => setWorkTab('availability')}>Dyspozycyjność</button><button type="button" role="tab" aria-selected={workTab === 'summary'} className={workTab === 'summary' ? 'active' : ''} onClick={() => setWorkTab('summary')}>Podsumowanie</button></div>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="visually-hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeFile(file); }} />
      {workTab === 'schedule' && !workProfileReady ? <section className="work-action-guidance" aria-label="Wymaganie przed importem grafiku"><div><strong>{importReadiness.reason === 'MISSING_EMPLOYEE_NAME' ? 'Uzupełnij profil pracy' : 'Najpierw ustaw profil pracy'}</strong><span>{importReadiness.reason === 'MISSING_EMPLOYEE_NAME' ? 'Wpisz imię i nazwisko dokładnie tak, jak występuje w grafiku PDF.' : 'Aplikacja potrzebuje Twojego imienia i nazwiska z grafiku, aby rozpoznać właściwe zmiany.'}</span></div><button type="button" className="button button-secondary button-small" onClick={() => setSettingsOpen(true)}>{importReadiness.actionLabel}</button></section> : null}
      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}

      {workTab === 'availability' ? <AvailabilityView onDataChanged={async () => { await Promise.all([refresh(), onDataChanged()]); }} onOpenSettings={() => setSettingsOpen(true)} /> : workTab === 'summary' ? <WorkSummaryView workEvents={confirmedWorkEvents} workImports={imports} availabilityPlans={availabilityPlans} onImportClick={requestPdfImport} onOpenComparison={() => { setComparisonDetailsRequest((value) => value + 1); setWorkTab('schedule'); }} onOpenAvailability={() => setWorkTab('availability')} initialMonth={latestActive?.periodStart.slice(0, 7)} /> : <>
        <section className="work-quick-summary" aria-label="Praca w tym miesiącu"><div><span>Ten miesiąc</span><strong>{formatWorkMinutes(summary.totalConfirmedWorkMinutes)}</strong></div><div><span>Zmiany z grafiku</span><strong>{currentMonthShiftCount}</strong></div><div><span>Aktywny grafik</span><strong>{latestActive ? formatPeriod(latestActive.periodStart) : 'Brak'}</strong></div></section>

        {analysis ? <section className="panel work-analysis-card"><div className="panel-heading"><div><p className="section-kicker">Podgląd przed zapisem</p><h2>{analysis.activeImport ? 'Aktualizacja grafiku' : 'Nowy grafik'} - {formatPeriod(analysis.result.periodStart)}</h2></div><button type="button" className="text-button" onClick={() => setAnalysis(null)}>Anuluj</button></div><div className="work-analysis-metrics"><div><span>Profil</span><strong>{analysis.targetName}</strong></div><div><span>Zmiany</span><strong>{analysis.candidates.length}</strong></div><div><span>Policzono</span><strong>{formatWorkMinutes(parsedSum)}</strong></div><div><span>PDF podaje</span><strong>{sourceSum !== undefined ? formatWorkMinutes(sourceSum) : 'brak'}</strong></div><div><span>Kolizje</span><strong>{analysis.collisions.filter((item) => item.kind === 'OVERLAP').length}</strong></div><div><span>Zespół</span><strong>{analysis.coworkers.length ? `${new Set(analysis.coworkers.map((item) => item.normalizedName)).size} osób` : 'wyłączony'}</strong></div></div>
          {sourceSum !== undefined && sourceSum !== parsedSum ? <div className="study-message error-message">PDF podaje {formatWorkMinutes(sourceSum)}, a parser policzył {formatWorkMinutes(parsedSum)}. Sprawdź grafik przed zatwierdzeniem.</div> : null}
          {analysis.diff ? <div className="work-diff-summary"><strong>Co zmienił nowy grafik?</strong><span>+ {analysis.diff.summary.added} nowych</span><span>- {analysis.diff.summary.removed} usuniętych</span><span>~ {analysis.diff.summary.changed} zmienionych</span><span>! {analysis.diff.summary.conflicts} konfliktów</span><span>= {analysis.diff.summary.unchanged} bez zmian</span></div> : null}
          {analysis.diff?.summary.conflicts ? <fieldset className="series-scope-picker"><legend>Konflikty z ręcznymi zmianami</legend><label><input type="radio" checked={conflictDecision === 'PRESERVE_USER'} onChange={() => setConflictDecision('PRESERVE_USER')} /><span>Zachowaj moje ręczne zmiany</span></label><label><input type="radio" checked={conflictDecision === 'USE_NEW'} onChange={() => setConflictDecision('USE_NEW')} /><span>Użyj danych z nowego grafiku</span></label></fieldset> : null}
          {analysis.collisions.length ? <div className="work-collision-list"><strong>Kolizje i brak buforu</strong>{analysis.collisions.slice(0, 12).map((collision, index) => <div key={`${collision.eventId}-${collision.candidate.date}-${index}`} className={`work-collision ${collision.kind.toLowerCase()}`}><span>{formatDate(collision.candidate.date)} {collision.candidate.startTime}-{collision.candidate.endTime}</span><span>{collision.kind === 'OVERLAP' ? 'KOLIZJA' : collision.kind === 'TOUCHING' ? 'BRAK BUFORU' : 'MOŻLIWY DUPLIKAT'} - {collision.eventTitle}</span></div>)}</div> : null}
          <div className="work-shift-preview"><strong>Zmiany z PDF</strong>{analysis.candidates.map((shift) => <div key={shift.workOccurrenceKey}><span>{formatDate(shift.date)}</span><strong>{shift.startTime}-{shift.endTime}</strong><span>{formatWorkMinutes(shift.minutes)}</span></div>)}</div>
          <div className="work-import-actions"><button type="button" className="button button-secondary" onClick={() => setAnalysis(null)} disabled={saving}>Anuluj</button><button type="button" className="button button-primary" onClick={() => void commit()} disabled={saving}>{saving ? 'Zapisywanie...' : analysis.activeImport ? 'Zastosuj aktualizację' : 'Dodaj grafik'}</button></div></section> : null}

        <section className="panel work-next-card"><div className="panel-heading compact-heading"><div><span className="section-kicker">Najbliższa zmiana</span><h2>{nearestEvent ? `${formatDate(nearestEvent.startDateTime.slice(0,10))}, ${nearestEvent.startDateTime.slice(11,16)}-${nearestEvent.endDateTime.slice(11,16)}` : 'Brak nadchodzącej zmiany'}</h2></div></div>{nearestEvent ? <div className="next-work-shift"><span>{locations.find((location) => location.id === nearestEvent.locationId)?.name ?? profile?.workplaceName ?? 'Praca'}</span>{(coworkersByEvent[nearestEvent.id] ?? []).length ? <div className="coworker-inline"><small>Z Tobą:</small>{(coworkersByEvent[nearestEvent.id] ?? []).slice(0,3).map((person) => <span key={`${person.displayName}-${person.coworkerStartTime}`}>{person.displayName}</span>)}{(coworkersByEvent[nearestEvent.id] ?? []).length > 3 ? <span>+{(coworkersByEvent[nearestEvent.id] ?? []).length - 3}</span> : null}</div> : <small className="muted-copy">Brak zapisanych nakładających się zmian zespołu.</small>}</div> : <p className="muted-copy">Po imporcie PDF najbliższa zmiana pojawi się tutaj.</p>}</section>

        <AvailabilityWorkComparisonPanel plans={availabilityPlans} workEvents={workEvents} workImports={imports} onImportClick={requestPdfImport} openDetailsRequest={comparisonDetailsRequest} />

        {activeWorkEvents.length ? <section className="panel work-roster-list"><div className="panel-heading compact-heading work-roster-heading"><div><span className="section-kicker">Grafik</span><h2>Zmiany i zespół</h2><p>{latestActive ? `${formatPeriod(latestActive.periodStart)} · ` : ''}{activeWorkEvents.length} {activeWorkEvents.length === 1 ? 'zmiana' : 'zmian'}{latestActive ? ` · ${formatWorkMinutes(latestActive.totalMinutes)}` : ''}</p></div></div><div className="work-shift-list">{[...activeWorkEvents].sort((a,b)=>a.startDateTime.localeCompare(b.startDateTime)).map((event) => { const coworkers = coworkersByEvent[event.id] ?? []; const ownMinutes = Math.max(0, Math.round((Date.parse(event.endDateTime) - Date.parse(event.startDateTime)) / 60000)); return <article key={event.id} className="work-shift-row"><div className="work-own-shift"><strong className="work-shift-date">{formatDate(event.startDateTime.slice(0,10))}</strong><span className="work-shift-label">Twoja zmiana</span><div className="work-own-shift-time"><strong>{event.startDateTime.slice(11,16)}-{event.endDateTime.slice(11,16)}</strong><span>{formatWorkMinutes(ownMinutes)}</span></div></div><div className="work-shift-team"><div className="work-team-heading"><span>Na zmianie razem</span><strong>{coworkers.length} {coworkers.length === 1 ? 'współpracownik' : 'współpracowników'}</strong></div><CoworkerOverlapList people={coworkers} /></div></article>; })}</div></section> : null}

        {imports.length ? <details className="panel work-history work-history-details"><summary>Historia importów ({imports.length})</summary><div className="import-history-grid">{imports.map((item) => <article key={item.id} className="import-history-card"><div><strong>{formatPeriod(item.periodStart)}</strong><span className="status-pill">{item.lifecycleStatus === 'ACTIVE' ? 'AKTYWNY' : item.lifecycleStatus === 'HISTORICAL' ? 'HISTORYCZNY' : 'USUNIĘTY'}</span></div><p>{item.fileName}</p><small>{item.shiftCount} zmian - {formatWorkMinutes(item.totalMinutes)}</small>{item.lifecycleStatus !== 'DELETED' ? <button type="button" className="text-button warning-text" onClick={() => void removeImport(item)}>Usuń import</button> : null}</article>)}</div></details> : null}
      </>}

      {settingsOpen ? <Modal title="Ustawienia pracy" onClose={() => setSettingsOpen(false)} wide><div className="work-settings-modal"><section><div className="panel-heading compact-heading"><div><span className="section-kicker">Miejsce pracy</span><h3>Profil grafiku</h3></div></div><WorkProfileEditor locations={locations} compact onSaved={async (saved) => { setProfile(saved); await Promise.all([refresh(), onDataChanged()]); }} /></section><section className="work-settings-divider"><PlanningSettings onDataChanged={async () => { await Promise.all([refresh(), onDataChanged()]); }} /></section></div></Modal> : null}
    </section>
  );
}
