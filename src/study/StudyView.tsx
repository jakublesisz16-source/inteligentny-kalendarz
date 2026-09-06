import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeScheduleWorkbook, diagnoseUnrecognizedWorkbook } from '../imports/xlsx/adapter-registry';
import { validateCandidateForImport } from '../imports/xlsx/import-validation';
import { readSpreadsheetFile } from '../imports/xlsx/spreadsheet-reader';
import { formatStudyGroupList, studyGroupCompactLabel, studyGroupDisplayLabel } from '../imports/xlsx/group-normalizer';
import {
  applyUniversityScheduleUpdate,
  cancelScheduleUpdate,
  commitUniversityImport,
  deleteUniversityImport,
  findUniversityImportByHash,
  getActiveUniversityImport,
  getStudyProfile,
  listUniversityImports,
  prepareUniversityScheduleUpdate,
} from '../storage/database';
import {
  applyManualCorrection,
  defaultIncludeForCandidate,
  deselectAllCandidates,
  reviewCandidate,
  selectAllImportable,
  toggleCandidateSelection,
} from './import-review';
import { applySafeSeriesCorrection, pendingRulesForSeriesCorrection } from './study-corrections';
import { identifyCandidate } from './study-identity';
import { candidatesForSelectedGroups, findStudyScheduleConflicts, hashFile, validateStudyGroupSelection } from './study.service';
import { completenessForSelectedGroups } from './study-completeness';
import { ScheduleDiffView } from './ScheduleDiffView';
import { StudyGroupPreviewPanel } from './StudyGroupPreviewPanel';
import { StudyGroupSelector } from './StudyGroupSelector';
import { StudyProfileSettings } from './StudyProfileSettings';
import type {
  PendingStudyCorrectionRule,
  ScheduleAnalysis,
  ScheduleUpdatePreview,
  StudyScheduleCandidate,
  UniversityScheduleImport,
} from './study.types';

interface StudyViewProps {
  onDataChanged: () => Promise<void>;
}

type Phase = 'idle' | 'analysis' | 'groups' | 'preview' | 'confirm' | 'diff';
type PreviewFilter = 'all' | 'ready' | 'warning' | 'incomplete' | 'blocking';

interface SelectedFileMeta {
  file: File;
  hash: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatImportDate(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function candidateLabel(candidate: StudyScheduleCandidate): string {
  const date = candidate.date
    ? new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${candidate.date}T12:00:00`))
    : candidate.sourceWeekStart && candidate.sourceWeekEnd
      ? `tydzień ${candidate.sourceWeekStart} - ${candidate.sourceWeekEnd}`
      : 'brak daty';
  const time = candidate.startTime && candidate.endTime ? `${candidate.startTime}-${candidate.endTime}` : 'brak godzin';
  return `${date} - ${time}`;
}

function seriesPeerCount(candidates: StudyScheduleCandidate[], candidate: StudyScheduleCandidate): number {
  const identity = identifyCandidate(candidate);
  if (!identity.seriesKey) return 1;
  return candidates.filter((entry) => identifyCandidate(entry).seriesKey === identity.seriesKey).length;
}

interface CandidateEditorProps {
  candidate: StudyScheduleCandidate;
  peerCount: number;
  onSave: (candidate: StudyScheduleCandidate, scope: 'SINGLE' | 'SERIES') => void;
  onCancel: () => void;
}

function CandidateEditor({ candidate, peerCount, onSave, onCancel }: CandidateEditorProps) {
  const [subject, setSubject] = useState(candidate.subject);
  const [date, setDate] = useState(candidate.date ?? '');
  const [startTime, setStartTime] = useState(candidate.startTime ?? '');
  const [endTime, setEndTime] = useState(candidate.endTime ?? '');
  const [room, setRoom] = useState(candidate.room ?? '');
  const [address, setAddress] = useState(candidate.address ?? candidate.locationLabel ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const sourceWeekWarning = candidate.warnings.find((warning) => /tygodnia\s+\d{4}-\d{2}-\d{2}/i.test(warning));

  function buildUpdated(): StudyScheduleCandidate {
    const updated: StudyScheduleCandidate = {
      ...candidate,
      subject: subject.trim(),
      ...(date ? { date } : {}),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(room.trim() ? { room: room.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      manuallyReviewed: true,
    };
    if (!room.trim()) delete updated.room;
    if (!address.trim()) delete updated.address;
    if (address.trim()) delete updated.locationLabel;
    return identifyCandidate(updated);
  }

  function save(scope: 'SINGLE' | 'SERIES') {
    const updated = buildUpdated();
    const validation = validateCandidateForImport(updated);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    if (scope === 'SERIES' && !pendingRulesForSeriesCorrection(candidate, updated).length) {
      setErrors(['Zbiorczo można uzupełnić bezpieczne dane lokalizacji, np. adres lub salę. Data i godziny zawsze dotyczą tylko tego terminu.']);
      return;
    }
    onSave(updated, scope);
  }

  return (
    <div className="candidate-editor">
      <div className="form-grid two-columns">
        <label className="field full-field"><span>Przedmiot</span><input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <label className="field"><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <div className="form-grid two-columns compact-time-grid">
          <label className="field"><span>Od</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          <label className="field"><span>Do</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        </div>
        <label className="field"><span>Sala</span><input value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Opcjonalnie" /></label>
        <label className="field"><span>Adres / lokalizacja</span><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Np. ul. Testowa 1" /></label>
      </div>
      {sourceWeekWarning ? <div className="study-information warning-info"><strong>Uwaga na wpis tygodniowy.</strong> {sourceWeekWarning} Podanie jednej daty utworzy tylko jedno wydarzenie - nie oznacza automatycznie całego tygodnia praktyk.</div> : null}
      {errors.length ? <div className="inline-error">{errors.join(' ')}</div> : null}
      {peerCount > 1 ? <p className="series-correction-hint">Ta seria ma {peerCount} powiązanych terminów. Bezpieczne dane lokalizacji możesz uzupełnić jednocześnie dla całej serii.</p> : null}
      <div className="candidate-editor-actions">
        <button type="button" className="button button-secondary" onClick={onCancel}>Anuluj</button>
        <button type="button" className="button button-secondary" onClick={() => save('SINGLE')}>Tylko ten termin</button>
        {peerCount > 1 ? <button type="button" className="button button-primary" onClick={() => save('SERIES')}>Zastosuj do powiązanych</button> : <button type="button" className="button button-primary" onClick={() => save('SINGLE')}>Zapisz</button>}
      </div>
    </div>
  );
}

export function StudyView({ onDataChanged }: StudyViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [analysis, setAnalysis] = useState<ScheduleAnalysis | null>(null);
  const [fileMeta, setFileMeta] = useState<SelectedFileMeta | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [workingCandidates, setWorkingCandidates] = useState<StudyScheduleCandidate[]>([]);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [imports, setImports] = useState<UniversityScheduleImport[]>([]);
  const [profileGroups, setProfileGroups] = useState<string[]>([]);
  const [activeImport, setActiveImport] = useState<UniversityScheduleImport | null>(null);
  const [updatePreview, setUpdatePreview] = useState<ScheduleUpdatePreview | null>(null);
  const [pendingCorrectionRules, setPendingCorrectionRules] = useState<PendingStudyCorrectionRule[]>([]);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  useEffect(() => { void refreshStudyData(); }, []);

  async function refreshStudyData() {
    const [loadedImports, profile, active] = await Promise.all([listUniversityImports(), getStudyProfile(), getActiveUniversityImport()]);
    setImports(loadedImports);
    setProfileGroups(profile?.selectedGroups ?? []);
    setActiveImport(active ?? null);
  }

  async function processFile(file: File) {
    setError('');
    setMessage('');
    setDiagnostics([]);
    if (!/\.xlsx?$/i.test(file.name)) {
      setError('Wybierz plik programu Excel w formacie .xlsx albo .xls.');
      return;
    }
    setParsing(true);
    setAnalysis(null);
    setUpdatePreview(null);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const hash = await hashFile(file);
      const duplicate = await findUniversityImportByHash(hash);
      if (duplicate) {
        setMessage(`Ten sam plik został już zaimportowany ${formatImportDate(duplicate.importedAt)}. Nie utworzono duplikatów.`);
        return;
      }
      const workbook = await readSpreadsheetFile(file);
      const result = analyzeScheduleWorkbook(workbook);
      if (!result) {
        setError('Nie rozpoznano formatu planu. Dane nie zostały zapisane.');
        setDiagnostics(diagnoseUnrecognizedWorkbook(workbook));
        return;
      }
      setAnalysis(result);
      setFileMeta({ file, hash });
      const remembered = profileGroups.filter((group) => result.groups.includes(group));
      setSelectedGroups(remembered);
      setPhase('analysis');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się przeanalizować pliku Excel.');
    } finally {
      setParsing(false);
    }
  }

  function toggleGroup(group: string) {
    setSelectedGroups((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group]);
  }

  function goToPreview() {
    if (!analysis) return;
    const groupValidation = validateStudyGroupSelection(analysis.groups, selectedGroups);
    if (!groupValidation.valid) {
      setError(groupValidation.errors.join(' '));
      return;
    }
    const filtered = candidatesForSelectedGroups(analysis, selectedGroups).map((candidate) => {
      const identified = identifyCandidate(candidate);
      return { ...identified, include: defaultIncludeForCandidate(identified) };
    });
    setWorkingCandidates(filtered);
    setPendingCorrectionRules([]);
    setPreviewFilter('all');
    setError('');
    setPhase('preview');
  }

  function updateCandidate(source: StudyScheduleCandidate, updated: StudyScheduleCandidate, scope: 'SINGLE' | 'SERIES') {
    const changedFields = [
      source.subject !== updated.subject ? 'subject' : undefined,
      source.date !== updated.date ? 'date' : undefined,
      source.startTime !== updated.startTime ? 'startTime' : undefined,
      source.endTime !== updated.endTime ? 'endTime' : undefined,
      source.room !== updated.room ? 'room' : undefined,
      source.address !== updated.address ? 'address' : undefined,
      source.clinic !== updated.clinic ? 'clinic' : undefined,
      source.locationLabel !== updated.locationLabel ? 'locationLabel' : undefined,
    ].filter((field): field is NonNullable<StudyScheduleCandidate['manuallyModifiedFields']>[number] => Boolean(field));
    const corrected = applyManualCorrection(identifyCandidate({
      ...updated,
      manuallyModifiedFields: [...new Set([...(source.manuallyModifiedFields ?? []), ...changedFields])],
    }));
    if (scope === 'SERIES') {
      const rules = pendingRulesForSeriesCorrection(source, corrected);
      setPendingCorrectionRules((current) => {
        const next = [...current];
        for (const rule of rules) {
          const index = next.findIndex((entry) => entry.seriesKey === rule.seriesKey && entry.field === rule.field);
          if (index >= 0) next[index] = rule;
          else next.push(rule);
        }
        return next;
      });
      const previous = new Map(workingCandidates.map((candidate) => [candidate.id, candidate]));
      let changedCount = 0;
      const updatedCandidates = applySafeSeriesCorrection(workingCandidates, source, corrected).map((candidate) => {
        const before = previous.get(candidate.id);
        const changed = Boolean(before) && (
          before?.address !== candidate.address
          || before?.room !== candidate.room
          || before?.clinic !== candidate.clinic
          || before?.locationLabel !== candidate.locationLabel
        );
        if (changed) {
          changedCount += 1;
          return applyManualCorrection(candidate);
        }
        return candidate;
      });
      setWorkingCandidates(updatedCandidates);
      setMessage(`Uzupełniono bezpieczne dane dla ${Math.max(changedCount, 1)} powiązanych terminów.`);
    } else {
      setWorkingCandidates((current) => current.map((candidate) => candidate.id === corrected.id ? corrected : candidate));
    }
    setEditingCandidateId(null);
  }

  function toggleCandidate(id: string) {
    setWorkingCandidates((current) => current.map((candidate) => candidate.id === id ? toggleCandidateSelection(candidate) : candidate));
  }

  function handleCandidateKeyDown(event: React.KeyboardEvent<HTMLElement>, candidate: StudyScheduleCandidate) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleCandidate(candidate.id);
  }

  const candidateReviews = useMemo(() => new Map(workingCandidates.map((candidate) => [candidate.id, reviewCandidate(candidate)])), [workingCandidates]);
  const visibleCandidates = useMemo(() => workingCandidates.filter((candidate) => {
    const state = candidateReviews.get(candidate.id)?.state ?? 'READY';
    if (previewFilter === 'ready') return state === 'READY';
    if (previewFilter === 'warning') return state === 'WARNING';
    if (previewFilter === 'incomplete') return state === 'INCOMPLETE';
    if (previewFilter === 'blocking') return state === 'BLOCKING';
    return true;
  }), [candidateReviews, workingCandidates, previewFilter]);
  const importable = useMemo(() => workingCandidates.filter((candidate) => candidate.include && reviewCandidate(candidate).canImport), [workingCandidates]);
  const scheduleConflicts = useMemo(() => findStudyScheduleConflicts(importable), [importable]);
  const groupSelectionValidation = useMemo(() => analysis ? validateStudyGroupSelection(analysis.groups, selectedGroups) : { valid: true, errors: [] }, [analysis, selectedGroups]);
  const selectedCompleteness = useMemo(() => analysis ? completenessForSelectedGroups(analysis, selectedGroups) : null, [analysis, selectedGroups]);
  const strictHourAudits = useMemo(() => selectedCompleteness?.hourAudits.filter((audit) => audit.enforcement === 'STRICT') ?? [], [selectedCompleteness]);
  const incompleteHourAudits = useMemo(() => strictHourAudits.filter((audit) => audit.status === 'SOURCE_INCOMPLETE'), [strictHourAudits]);
  const advisoryHourInconsistencies = useMemo(() => selectedCompleteness?.hourAudits.filter((audit) => audit.enforcement === 'ADVISORY' && audit.status === 'SOURCE_INCONSISTENT') ?? [], [selectedCompleteness]);
  const invalidIncluded = useMemo(() => importable.filter((candidate) => !validateCandidateForImport(candidate).valid), [importable]);
  const readyPreviewCount = useMemo(() => workingCandidates.filter((candidate) => reviewCandidate(candidate).state === 'READY').length, [workingCandidates]);
  const warningPreviewCount = useMemo(() => workingCandidates.filter((candidate) => reviewCandidate(candidate).state === 'WARNING').length, [workingCandidates]);
  const incompletePreviewCount = useMemo(() => workingCandidates.filter((candidate) => reviewCandidate(candidate).state === 'INCOMPLETE').length, [workingCandidates]);
  const blockingPreviewCount = useMemo(() => workingCandidates.filter((candidate) => reviewCandidate(candidate).state === 'BLOCKING').length, [workingCandidates]);
  const possibleCount = readyPreviewCount + warningPreviewCount;
  const selectedWarningCount = useMemo(() => workingCandidates.filter((candidate) => candidate.include && reviewCandidate(candidate).state === 'WARNING').length, [workingCandidates]);
  const manuallyExcludedCount = useMemo(() => workingCandidates.filter((candidate) => !candidate.include && reviewCandidate(candidate).canImport).length, [workingCandidates]);
  const reviewedCount = workingCandidates.filter((candidate) => candidate.manuallyReviewed && candidate.include).length;

  async function continueAfterPreview() {
    if (!analysis || !fileMeta || invalidIncluded.length || !importable.length) return;
    if (!activeImport) {
      setPhase('confirm');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const preview = await prepareUniversityScheduleUpdate({
        fileName: fileMeta.file.name,
        fileSize: fileMeta.file.size,
        fileHash: fileMeta.hash,
        adapterId: analysis.adapterId,
        sheetNames: analysis.sheetNames,
        ...(analysis.detectedAcademicYear ? { detectedAcademicYear: analysis.detectedAcademicYear } : {}),
        ...(analysis.detectedTerm ? { detectedTerm: analysis.detectedTerm } : {}),
        selectedGroups,
        availableGroups: analysis.groups,
        allowScheduleConflicts: scheduleConflicts.length > 0,
        candidates: workingCandidates.filter((candidate) => candidate.include !== false || !reviewCandidate(candidate).canImport),
        allCandidates: analysis.candidates,
        ...(analysis.sourceBlocks?.length ? { sourceBlocks: analysis.sourceBlocks } : {}),
      });
      setUpdatePreview(preview);
      setPhase('diff');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się przygotować porównania planów.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmImport() {
    if (!analysis || !fileMeta || invalidIncluded.length || !importable.length) return;
    setSaving(true);
    setError('');
    try {
      const result = await commitUniversityImport({
        fileName: fileMeta.file.name,
        fileSize: fileMeta.file.size,
        fileHash: fileMeta.hash,
        adapterId: analysis.adapterId,
        sheetNames: analysis.sheetNames,
        ...(analysis.detectedAcademicYear ? { detectedAcademicYear: analysis.detectedAcademicYear } : {}),
        ...(analysis.detectedTerm ? { detectedTerm: analysis.detectedTerm } : {}),
        selectedGroups,
        availableGroups: analysis.groups,
        allowScheduleConflicts: scheduleConflicts.length > 0,
        candidates: workingCandidates,
        allCandidates: analysis.candidates,
        ...(analysis.sourceBlocks?.length ? { sourceBlocks: analysis.sourceBlocks } : {}),
        pendingCorrectionRules,
      });
      await Promise.all([refreshStudyData(), onDataChanged()]);
      resetFlow(false);
      setMessage(`Zaimportowano ${result.eventCount} wydarzeń. Utworzono ${result.newLocationCount} nowych lokalizacji.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się zapisać importu.');
    } finally {
      setSaving(false);
    }
  }

  async function applyUpdate() {
    if (!updatePreview) return;
    setSaving(true);
    setError('');
    try {
      const result = await applyUniversityScheduleUpdate({ ...updatePreview, allowScheduleConflicts: Boolean(updatePreview.scheduleConflicts?.length) });
      await Promise.all([refreshStudyData(), onDataChanged()]);
      resetFlow(false);
      setMessage(`Plan został zaktualizowany. Dodano ${result.added}, zmieniono ${result.changed}, usunięto ${result.removed}. Zachowano ${result.keptUserModified} ręcznych poprawek.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się zastosować aktualizacji planu.');
    } finally {
      setSaving(false);
    }
  }

  async function cancelUpdate() {
    if (updatePreview) await cancelScheduleUpdate(updatePreview);
    setUpdatePreview(null);
    setPhase('preview');
  }

  function resetFlow(clearMessage = true) {
    setPhase('idle');
    setAnalysis(null);
    setFileMeta(null);
    setSelectedGroups([]);
    setWorkingCandidates([]);
    setEditingCandidateId(null);
    setPreviewFilter('all');
    setError('');
    if (clearMessage) setMessage('');
    setDiagnostics([]);
    setDragActive(false);
    setUpdatePreview(null);
    setPendingCorrectionRules([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function removeImport(importRecord: UniversityScheduleImport) {
    const isActive = importRecord.id === activeImport?.id;
    const label = isActive ? 'aktywny plan i powiązane z nim wydarzenia' : 'historyczny zapis importu';
    const confirmed = window.confirm(`Usunąć ${label} „${importRecord.fileName}”? Wydarzenia ręczne pozostaną bez zmian.`);
    if (!confirmed) return;
    await deleteUniversityImport(importRecord.id);
    await Promise.all([refreshStudyData(), onDataChanged()]);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) void processFile(file);
  }

  const analysisReviews = analysis?.candidates.map((candidate) => reviewCandidate(candidate)) ?? [];
  const readyCount = analysisReviews.filter((review) => review.state === 'READY').length;
  const warningCount = analysisReviews.filter((review) => review.state === 'WARNING').length;
  const incompleteCount = analysisReviews.filter((review) => review.state === 'INCOMPLETE').length;
  const blockingCount = analysisReviews.filter((review) => review.state === 'BLOCKING').length;
  const phaseIndex = phase === 'idle' ? (parsing ? 1 : 0) : phase === 'analysis' ? 1 : phase === 'groups' ? 2 : phase === 'preview' ? 3 : phase === 'diff' ? 4 : 5;
  const progressLabels = ['Plik', 'Analiza', 'Grupy', 'Podgląd', 'Zmiany', 'Zapis'];

  return (
    <section className="view-shell study-view">
      <header className="view-header hero-header">
        <div>
          <p className="eyebrow">Studia</p>
          <h1>{activeImport ? 'Aktualizuj plan bez chaosu' : 'Plan zajęć bez ręcznego przepisywania'}</h1>
          <p className="view-subtitle">{activeImport ? 'Nowy plan Excel zostanie najpierw porównany z aktywnym planem. Nic nie zmieni się bez Twojego zatwierdzenia.' : 'Wybierz plan Excel (.xlsx lub .xls), zaznacz swoje grupy i sprawdź wynik przed dodaniem czegokolwiek do kalendarza.'}</p>
        </div>
        {phase !== 'idle' ? <button type="button" className="button button-secondary" onClick={() => resetFlow()}>Zacznij od nowa</button> : null}
      </header>

      <div className="study-progress six-steps" aria-label="Postęp importu">
        {progressLabels.map((label, index) => <div key={label} className={index <= phaseIndex ? 'study-step active' : 'study-step'}><span>{index + 1}</span>{label}</div>)}
      </div>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}
      {diagnostics.length ? <div className="diagnostics-card"><strong>Wykryte arkusze i zakresy</strong>{diagnostics.map((line) => <span key={line}>{line}</span>)}</div> : null}

      {activeImport && phase === 'idle' ? <StudyGroupPreviewPanel activeImport={activeImport} primaryGroups={profileGroups} /> : null}

      {phase === 'idle' ? (
        <div className={dragActive ? 'upload-panel panel drag-active' : 'upload-panel panel'} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}>
          <div className="upload-mark" aria-hidden="true">XLS</div>
          <h2>{activeImport ? 'Dodaj nowszą wersję planu' : 'Nie masz jeszcze planu zajęć'}</h2>
          {activeImport ? <p>Aktywny plan: <strong>{activeImport.fileName}</strong>. Nowy plik zostanie porównany lokalnie i zobaczysz dokładnie, co się zmieniło.</p> : <p>Zaimportuj plik Excel, wybierz swoje grupy i sprawdź zajęcia przed zapisaniem ich w Kalendarzu. Plik jest analizowany wyłącznie lokalnie.</p>}
          <input ref={fileInputRef} className="visually-hidden" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => { const file = event.target.files?.[0]; if (file) void processFile(file); }} />
          <button type="button" className="button button-primary" disabled={parsing} onClick={() => fileInputRef.current?.click()}>{parsing ? 'Analizuję plan...' : activeImport ? 'Wybierz nowy plan Excel' : 'Importuj Excel'}</button>
          <span className="upload-hint">Na komputerze możesz też przeciągnąć plik tutaj.</span>
        </div>
      ) : null}

      {phase === 'analysis' && analysis && fileMeta ? (
        <section className="panel analysis-summary">
          <div className="panel-heading"><div><p className="section-kicker">Analiza</p><h2>{fileMeta.file.name}</h2></div><span className="file-size">{formatBytes(fileMeta.file.size)}</span></div>
          <div className="analysis-metrics">
            <div><span>Format</span><strong>{analysis.adapterId}</strong></div><div><span>Arkusze</span><strong>{analysis.sheetNames.length}</strong></div><div><span>Rok</span><strong>{analysis.detectedAcademicYear ?? 'Niepewny'}</strong></div><div><span>Semestr</span><strong>{analysis.detectedTerm ?? 'Niepewny'}</strong></div><div><span>Dni</span><strong>{analysis.diagnostics?.detectedDays?.length ?? 'Niepewne'}</strong></div>{analysis.diagnostics?.layoutKind === 'WEEK_MATRIX' ? <div><span>Tygodnie</span><strong>{analysis.diagnostics.weekRowCount ?? 0}</strong></div> : <div><span>Siatki czasu</span><strong>{analysis.diagnostics?.timeGridCount ?? 'Niepewne'}</strong></div>}{analysis.diagnostics?.lectureEntryCount ? <div><span>Wykłady</span><strong>{analysis.diagnostics.lectureEntryCount}</strong></div> : null}<div><span>Grupy</span><strong>{analysis.groups.length}</strong></div><div><span>Gotowe</span><strong>{readyCount}</strong></div><div><span>Do sprawdzenia</span><strong>{warningCount}</strong></div><div><span>Niepełne</span><strong>{incompleteCount}</strong></div><div><span>Wymagają poprawy</span><strong>{blockingCount}</strong></div>
          </div>
          {analysis.diagnostics ? <details className="parser-diagnostics"><summary>Diagnostyka parsera</summary><div className="parser-diagnostics-grid"><span><strong>Arkusz planu:</strong> {analysis.diagnostics.matchedSheet ?? 'nieustalony'}</span><span><strong>Wykryte dni:</strong> {analysis.diagnostics.detectedDays?.join(', ') || 'brak'}</span>{analysis.diagnostics.layoutKind === 'WEEK_MATRIX' ? <><span><strong>Układ:</strong> macierz tygodniowa</span><span><strong>Wiersze tygodni:</strong> {analysis.diagnostics.weekRowCount ?? 0}</span>{analysis.diagnostics.lectureEntryCount ? <span><strong>Wpisy wykładów:</strong> {analysis.diagnostics.lectureEntryCount}</span> : null}</> : <span><strong>Interwały siatek:</strong> {analysis.diagnostics.timeGridIntervals?.length ? `${analysis.diagnostics.timeGridIntervals.join(', ')} min` : 'nieustalone'}</span>}<span><strong>Ukryte wiersze/kolumny:</strong> {analysis.diagnostics.hiddenRowCount ?? 0} / {analysis.diagnostics.hiddenColumnCount ?? 0}</span>{analysis.diagnostics.usedRanges?.map((line) => <span key={line}><strong>Zakres:</strong> {line}</span>)}{analysis.diagnostics.adapterReasons?.map((line) => <span key={line}><strong>Sygnał:</strong> {line}</span>)}{analysis.diagnostics.unresolvedPatterns?.map((line) => <span key={line}><strong>Niepewność:</strong> {line}</span>)}</div></details> : null}
          {analysis.information.map((item) => <div key={item.id} className="study-information"><strong>{item.title}</strong><span>{item.message}</span></div>)}
          {analysis.warnings.map((warning) => <div key={warning} className="study-information warning-info">{warning}</div>)}
          <footer className="study-actions analysis-actions"><button type="button" className="button button-primary" onClick={() => analysis.groups.length ? setPhase('groups') : goToPreview()}>{analysis.groups.length ? 'Przejdź do wyboru grup' : 'Pokaż zajęcia'}</button></footer>
        </section>
      ) : null}

      {phase === 'groups' && analysis ? (
        <section className="panel group-panel">
          <div className="panel-heading"><div><p className="section-kicker">Twoje przypisania</p><h2>{analysis.groups.length ? 'Wybierz wszystkie swoje grupy' : 'Plan wspólny dla wszystkich'}</h2></div>{analysis.groups.length ? <span className="selection-count">{selectedGroups.length} wybranych</span> : null}</div>
          <p className="panel-copy">{analysis.groups.length ? 'Wybierz faktyczne przypisania. Grupa 4-osobowa obejmuje automatycznie odpowiadającą jej grupę 8-osobową i grupę główną. Podziału 12-osobowego nie wyliczamy z litery, bo przecina podział 8-osobowy.' : 'Ten plik nie zawiera rozróżnienia grup. Wpisy wspólne przejdą do podglądu bez wyboru grupy.'}</p>
          {analysis.groups.length ? <StudyGroupSelector groups={analysis.groups} selectedGroups={selectedGroups} onToggle={toggleGroup} /> : null}
          {!groupSelectionValidation.valid ? <div className="study-information warning-info"><strong>Uzupełnij wybór grup.</strong><ul>{groupSelectionValidation.errors.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          <footer className="study-actions split-study-actions"><button type="button" className="button button-secondary" onClick={() => setPhase('analysis')}>Wróć do analizy</button><button type="button" className="button button-primary" disabled={!groupSelectionValidation.valid} onClick={goToPreview}>Pokaż moje zajęcia</button></footer>
        </section>
      ) : null}

      {phase === 'preview' && analysis ? (
        <div className="study-stack">
          <section className="preview-toolbar panel">
            <div><p className="section-kicker">Podgląd</p><h2>{workingCandidates.length} pasujących wpisów</h2><p>Jeśli plan źródłowy nie podaje pełnych godzin, wpis pozostaje widoczny jako niepełny. Aplikacja niczego nie zgaduje i nie zapisuje takiego terminu do kalendarza, dopóki godziny nie będą znane.</p></div>
            <div className="preview-filters" role="group" aria-label="Filtr wpisów">
              <button type="button" className={previewFilter === 'all' ? 'filter-button active' : 'filter-button'} onClick={() => setPreviewFilter('all')}>Wszystkie ({workingCandidates.length})</button>
              <button type="button" className={previewFilter === 'ready' ? 'filter-button active' : 'filter-button'} onClick={() => setPreviewFilter('ready')}>Gotowe ({readyPreviewCount})</button>
              <button type="button" className={previewFilter === 'warning' ? 'filter-button active' : 'filter-button'} onClick={() => setPreviewFilter('warning')}>Do sprawdzenia ({warningPreviewCount})</button>
              <button type="button" className={previewFilter === 'incomplete' ? 'filter-button active' : 'filter-button'} onClick={() => setPreviewFilter('incomplete')}>Niepełne ({incompletePreviewCount})</button>
              <button type="button" className={previewFilter === 'blocking' ? 'filter-button active' : 'filter-button'} onClick={() => setPreviewFilter('blocking')}>Wymagają poprawy ({blockingPreviewCount})</button>
            </div>
          </section>
          {selectedCompleteness ? <section className="panel study-completeness-panel" aria-label="Kontrola kompletności planu źródłowego"><div className="study-completeness-heading"><div><p className="section-kicker">Kontrola kompletności</p><h3>Bloki i godziny źródłowe</h3></div><span className={selectedCompleteness.safe ? 'completeness-state safe' : 'completeness-state blocking'}>{selectedCompleteness.safe ? 'SPÓJNE' : 'BLOKADA'}</span></div><div className="study-completeness-stats"><div><span>Bloki źródłowe</span><strong>{selectedCompleteness.sourceBlockCount}</strong></div><div><span>Kompletne</span><strong>{selectedCompleteness.completeBlockCount}</strong></div><div><span>Niepełne w źródle</span><strong>{selectedCompleteness.incompleteSourceBlockCount}</strong></div><div><span>Bilans godzin</span><strong>{strictHourAudits.filter((audit) => audit.status === 'MATCH').length}/{strictHourAudits.length}</strong></div></div>{incompleteHourAudits.length ? <div className="study-completeness-note"><strong>{incompleteHourAudits.length} bilansów godzin nie da się zamknąć bez zgadywania.</strong><span>Źródło ma przypisanie grupy/bloku, ale nie podaje wszystkich dni lub pełnych godzin. Takie pozycje pozostają jako NIEPEŁNE i nie są zamieniane na fikcyjne wydarzenia.</span></div> : null}{advisoryHourInconsistencies.length ? <div className="study-completeness-note advisory"><strong>{advisoryHourInconsistencies.length} deklaracji godzin seminariów nie zgadza się z datowanymi terminami.</strong><span>To informacja o niespójności planu źródłowego. Aplikacja zachowuje konkretne daty i godziny z Excela i nie dopisuje brakujących zajęć.</span></div> : null}{selectedCompleteness.reasons.length ? <div className="inline-error">{selectedCompleteness.reasons.join(' ')}</div> : null}</section> : null}
          <section className="preview-selection panel" aria-label="Wybór wpisów do importu">
            <div className="preview-selection-summary"><strong>{importable.length} wybranych z {possibleCount} możliwych</strong><span>{warningPreviewCount} do sprawdzenia{incompletePreviewCount ? ` - ${incompletePreviewCount} niepełnych tylko do wglądu` : ''}{blockingPreviewCount ? ` - ${blockingPreviewCount} wymaga poprawy` : ''}</span></div>
            <div className="preview-bulk-actions"><button type="button" className="button button-secondary button-small" onClick={() => setWorkingCandidates((current) => selectAllImportable(current))}>Zaznacz wszystkie możliwe</button><button type="button" className="button button-secondary button-small" onClick={() => setWorkingCandidates((current) => deselectAllCandidates(current))}>Odznacz wszystkie</button></div>
          </section>
          {scheduleConflicts.length ? <section className="panel confirm-warning conflict-review-panel"><div className="conflict-review-heading"><strong>Wykryto {scheduleConflicts.length} konfliktów godzin.</strong><span>Informacja</span></div><p>To mogą być błędy źródłowego planu albo świadomie nakładające się zajęcia. Konflikty pozostają widoczne, ale nie wymagają dodatkowego potwierdzenia - przejście dalej oznacza zapis wybranych wpisów zgodnie z planem.</p><ul className="study-conflict-list">{scheduleConflicts.slice(0, 8).map((conflict) => <li key={conflict.id}><time>{conflict.date}</time><span><strong>{conflict.left.subject}</strong> {conflict.left.startTime}-{conflict.left.endTime}</span><span className="conflict-separator">↔</span><span><strong>{conflict.right.subject}</strong> {conflict.right.startTime}-{conflict.right.endTime}</span></li>)}</ul>{scheduleConflicts.length > 8 ? <p>...oraz {scheduleConflicts.length - 8} kolejnych konfliktów.</p> : null}</section> : null}
          <div className="candidate-list">
            {visibleCandidates.map((candidate) => {
              const review = candidateReviews.get(candidate.id) ?? reviewCandidate(candidate);
              const selected = Boolean(candidate.include) && review.canImport;
              const stateClass = review.state.toLocaleLowerCase('en-US');
              const statusLabel = review.state === 'READY' ? 'GOTOWE' : review.state === 'WARNING' ? 'DO SPRAWDZENIA' : review.state === 'INCOMPLETE' ? 'NIEPEŁNE' : 'WYMAGA POPRAWY';
              const peerCount = seriesPeerCount(workingCandidates, candidate);
              return (
                <article key={candidate.id} className={`candidate-card panel ${stateClass}${selected ? ' selected' : ' unselected'}`} tabIndex={0} role="group" aria-label={`${selected ? 'Wybrano do importu. ' : 'Pominięto. '}${statusLabel}. ${candidate.subject || 'Nieustalony przedmiot'}`} aria-disabled={!review.canImport} onClick={(event) => { const target = event.target as Element; if (target.closest('button, input, select, textarea, a, label, .candidate-editor')) return; toggleCandidate(candidate.id); }} onKeyDown={(event) => handleCandidateKeyDown(event, candidate)}>
                  <div className="candidate-main">
                    <label className="candidate-toggle" title={review.canImport ? 'Importuj lub pomiń wpis' : review.state === 'INCOMPLETE' ? 'Brak danych w planie źródłowym - wpis pozostaje do wglądu' : 'Najpierw popraw dane krytyczne'}><input type="checkbox" checked={selected} disabled={!review.canImport} aria-label={`${selected ? 'Pomiń' : 'Importuj'}: ${candidate.subject || 'wpis bez nazwy'}`} onChange={() => toggleCandidate(candidate.id)} /></label>
                    <div className="candidate-copy">
                      <div className="candidate-title-row"><h3>{candidate.subject || 'Nieustalony przedmiot'}</h3><span className={`status-pill ${stateClass}`}>{statusLabel}</span>{peerCount > 1 ? <span className="series-pill">Seria: {peerCount}</span> : null}</div>
                      <strong className="candidate-date">{candidateLabel(candidate)}</strong>
                      <div className="candidate-meta">{candidate.activityType ? <span>{candidate.activityType}</span> : null}{candidate.groupTags.length ? <span>Grupy: {formatStudyGroupList(candidate.groupTags)}</span> : null}{candidate.clinic ? <span>{candidate.clinic}</span> : null}{candidate.room ? <span>{candidate.room}</span> : null}{candidate.address || candidate.locationLabel ? <span>{candidate.address ?? candidate.locationLabel}</span> : null}</div>
                      {review.issues.length ? <div className={`candidate-issues ${review.state === 'BLOCKING' ? 'blocking' : review.state === 'INCOMPLETE' ? 'incomplete' : 'warning'}`}><strong>{review.state === 'BLOCKING' ? 'Przed importem popraw:' : review.state === 'INCOMPLETE' ? 'Brak danych w planie źródłowym:' : 'Brakujące lub niepewne dane:'}</strong><ul>{review.issues.map((issue) => <li key={`${issue.code}-${issue.source ?? ''}`}><span>{issue.label}</span>{issue.source && issue.source !== issue.label ? <small>{issue.source}</small> : null}</li>)}</ul></div> : null}
                      <small className="source-ref">Źródło: {candidate.sourceSheet} {candidate.sourceRange}</small>
                    </div>
                    <button type="button" className="text-button candidate-edit-action" onClick={(event) => { event.stopPropagation(); setEditingCandidateId(candidate.id); }}>{review.state === 'READY' ? 'Popraw' : review.state === 'INCOMPLETE' ? 'Uzupełnij ręcznie' : 'Uzupełnij dane'}</button>
                  </div>
                  {editingCandidateId === candidate.id ? <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><CandidateEditor candidate={candidate} peerCount={peerCount} onSave={(updated, scope) => updateCandidate(candidate, updated, scope)} onCancel={() => setEditingCandidateId(null)} /></div> : null}
                </article>
              );
            })}
          </div>
          <footer className="sticky-import-actions"><div><strong>{importable.length}</strong><span>wybranych</span>{incompletePreviewCount ? <small>{incompletePreviewCount} niepełnych pozostanie tylko do wglądu</small> : null}{blockingPreviewCount ? <small>{blockingPreviewCount} wymaga poprawy i zostanie pominiętych</small> : null}</div><button type="button" className="button button-primary" disabled={!importable.length || invalidIncluded.length > 0 || saving} onClick={() => void continueAfterPreview()}>{saving ? 'Przygotowuję...' : activeImport ? 'Porównaj z aktywnym planem' : 'Przejdź do potwierdzenia'}</button></footer>
        </div>
      ) : null}

      {phase === 'diff' && updatePreview ? <ScheduleDiffView preview={updatePreview} saving={saving} onChange={setUpdatePreview} onApply={() => void applyUpdate()} onCancel={() => void cancelUpdate()} /> : null}

      {phase === 'confirm' && analysis && fileMeta ? (
        <section className="panel confirm-panel">
          <p className="section-kicker">Potwierdzenie</p><h2>Sprawdź zakres przed zapisem</h2>
          <div className="confirm-grid"><div><span>Wydarzenia do dodania</span><strong>{importable.length}</strong></div><div><span>Do sprawdzenia</span><strong>{selectedWarningCount}</strong></div><div><span>Ręcznie poprawione</span><strong>{reviewedCount}</strong></div><div><span>Pominięte ręcznie</span><strong>{manuallyExcludedCount}</strong></div><div><span>Niepełne - tylko do wglądu</span><strong>{incompletePreviewCount}</strong></div><div><span>Wymagają poprawy</span><strong>{blockingPreviewCount}</strong></div><div><span>Reguły serii</span><strong>{pendingCorrectionRules.length}</strong></div><div><span>Wybrane grupy</span><strong>{formatStudyGroupList(selectedGroups) || 'Wspólne / bez grup'}</strong></div></div>
          {incompletePreviewCount ? <div className="confirm-warning">{incompletePreviewCount} wpisów nie ma pełnych godzin w planie źródłowym. Pozostają widoczne w podglądzie, ale nie zostaną zapisane do kalendarza bez pełnego zakresu godzin.</div> : null}
          {blockingPreviewCount ? <div className="confirm-warning">{blockingPreviewCount} wpisów ma rzeczywisty błąd wymagający poprawy i nie zostanie dodanych w tym imporcie.</div> : null}
          {scheduleConflicts.length ? <div className="confirm-warning">Konflikty godzin: {scheduleConflicts.length}. Zostaną zapisane zgodnie z wybranymi wpisami; możesz wrócić do podglądu, jeśli chcesz któryś pominąć.</div> : null}
          <div className="privacy-confirm">Plik źródłowy nie zostanie zapisany w bazie. Zachowamy fingerprint, znormalizowane dane potrzebne do kolejnych porównań i świadome poprawki serii.</div>
          <footer className="study-actions split-study-actions"><button type="button" className="button button-secondary" onClick={() => setPhase('preview')}>Wróć do podglądu</button><button type="button" className="button button-primary" disabled={saving} onClick={() => void confirmImport()}>{saving ? 'Zapisuję...' : `Dodaj ${importable.length} wydarzeń`}</button></footer>
        </section>
      ) : null}

      {phase === 'idle' ? <StudyProfileSettings onDataChanged={async () => { await Promise.all([refreshStudyData(), onDataChanged()]); }} /> : null}

      {imports.length ? (
        <section className="imports-section">
          <div className="compact-heading"><p className="section-kicker">Historia lokalna</p><h2>Plany studiów</h2></div>
          <div className="import-history-grid">
            {imports.map((item) => {
              const active = item.id === activeImport?.id || item.lifecycleStatus === 'ACTIVE';
              return <article key={item.id} className={`panel import-history-card${active ? ' active-import' : ''}`}><div><strong>{item.fileName}</strong><span>{formatImportDate(item.importedAt)}</span>{active ? <span className="active-plan-pill">AKTYWNY PLAN</span> : <span className="history-plan-pill">HISTORYCZNY</span>}</div><dl><div className="import-history-groups"><dt>Grupy aktywnego planu</dt><dd>{item.selectedGroups.length ? <span className="import-history-group-list">{item.selectedGroups.map((group) => <i key={group} title={studyGroupDisplayLabel(group)}>{studyGroupCompactLabel(group)}</i>)}</span> : 'Wspólne / bez grup'}</dd></div><div><dt>Wydarzenia</dt><dd>{item.importedEventCount}</dd></div><div><dt>Fingerprint</dt><dd>{item.fileHash.slice(0, 10)}...</dd></div></dl><button type="button" className="text-button danger-text" onClick={() => void removeImport(item)}>{active ? 'Usuń aktywny plan' : 'Usuń zapis historyczny'}</button></article>;
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}
