import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeScheduleWorkbook, diagnoseUnrecognizedWorkbook } from '../imports/xlsx/adapter-registry';
import { validateCandidateForImport } from '../imports/xlsx/import-validation';
import { readSpreadsheetFile } from '../imports/xlsx/spreadsheet-reader';
import { canonicalizeStudyGroupSelection, formatStudyGroupList, normalizeStudyGroupSelectionForAvailableGroups, studyGroupCompactLabel, studyGroupDisplayLabel } from '../imports/xlsx/group-normalizer';
import {
  applyUniversityScheduleUpdate,
  cancelScheduleUpdate,
  commitUniversityImport,
  deleteUniversityImport,
  findUniversityImportByHash,
  getActiveUniversityImport,
  getLatestAppliedScheduleUpdateSession,
  getStudyProfile,
  listUniversityImports,
  prepareUniversityScheduleUpdate,
} from '../storage/database';
import {
  applyManualCorrection,
  defaultIncludeForCandidate,
  reviewCandidate,
  selectAllImportable,
  toggleCandidateSelection,
} from './import-review';
import { applySafeSeriesCorrection, pendingRulesForSeriesCorrection } from './study-corrections';
import { identifyCandidate } from './study-identity';
import { candidatesForSelectedGroups, findStudyScheduleConflicts, hashFile, validateStudyGroupSelection } from './study.service';
import { completenessForSelectedGroups } from './study-completeness';
import { verifyStudyPlanSource } from './verified-study-plan';
import { ScheduleDiffView } from './ScheduleDiffView';
import { StudyGroupPreviewPanel } from './StudyGroupPreviewPanel';
import { StudyGroupChoiceFields, studyGroupChoiceProgress } from './StudyGroupChoiceFields';
import { StudyProfileSettings } from './StudyProfileSettings';
import type {
  PendingStudyCorrectionRule,
  ScheduleAnalysis,
  ScheduleDiffSummary,
  ScheduleUpdateSession,
  ScheduleUpdatePreview,
  StudyScheduleCandidate,
  UniversityScheduleImport,
} from './study.types';

interface StudyViewProps {
  onDataChanged: () => Promise<void>;
}

type Phase = 'idle' | 'groups' | 'preview' | 'diff';
type PreviewFilter = 'all' | 'ready' | 'warning' | 'incomplete' | 'blocking';

interface SelectedFileMeta {
  file: File;
  hash: string;
  verification: Awaited<ReturnType<typeof verifyStudyPlanSource>>;
}


function formatImportDate(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatUpdateSummary(summary: ScheduleDiffSummary): string {
  const conflicts = summary.conflicts + summary.ambiguous;
  const parts = [
    summary.added ? `Nowe +${summary.added}` : '',
    summary.changed ? `Zmienione ${summary.changed}` : '',
    summary.removed ? `Usunięte -${summary.removed}` : '',
    conflicts ? `Konflikty ${conflicts}` : '',
  ].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return 'bez zmian w zajęciach';
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

function formatSchedulePeriod(candidates: StudyScheduleCandidate[]): string {
  const dates = candidates.flatMap((candidate) => candidate.date ? [candidate.date] : []).sort();
  if (!dates.length) return 'Nieustalony';
  const formatter = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const first = formatter.format(new Date(`${dates[0]!}T12:00:00`));
  const last = formatter.format(new Date(`${dates[dates.length - 1]!}T12:00:00`));
  return first === last ? first : `${first} - ${last}`;
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
  const [latestAppliedUpdate, setLatestAppliedUpdate] = useState<ScheduleUpdateSession | null>(null);
  const [updatePreview, setUpdatePreview] = useState<ScheduleUpdatePreview | null>(null);
  const [pendingCorrectionRules, setPendingCorrectionRules] = useState<PendingStudyCorrectionRule[]>([]);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  useEffect(() => { void refreshStudyData(); }, []);

  async function refreshStudyData() {
    const [loadedImports, profile, active, latestUpdate] = await Promise.all([
      listUniversityImports(),
      getStudyProfile(),
      getActiveUniversityImport(),
      getLatestAppliedScheduleUpdateSession(),
    ]);
    setImports(loadedImports);
    setProfileGroups(profile?.selectedGroups ?? []);
    setActiveImport(active ?? null);
    setLatestAppliedUpdate(latestUpdate ?? null);
  }

  async function processFile(file: File) {
    setError('');
    setMessage('');
    setDiagnostics([]);
    if (!/\.xlsx?$/i.test(file.name)) {
      setError('Wybierz plan w formacie .xlsx albo .xls.');
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
        setMessage(`Ten plan został już wczytany ${formatImportDate(duplicate.importedAt)}. Niczego nie zdublowano.`);
        return;
      }
      const workbook = await readSpreadsheetFile(file);
      const result = analyzeScheduleWorkbook(workbook);
      if (!result) {
        setError('Nie udało się rozpoznać tego planu. Nic nie zostało zapisane.');
        setDiagnostics(diagnoseUnrecognizedWorkbook(workbook));
        return;
      }
      const verification = await verifyStudyPlanSource({
        fileName: file.name,
        fileSize: file.size,
        fileHash: hash,
        analysis: result,
        workbook,
      });
      if (verification.state === 'BLOCKED_REFERENCE_DRIFT') {
        setError('Znany plan 25.09.2026 nie zgadza się ze zweryfikowaną referencją. Import został zablokowany, żeby nie zapisać cichej regresji parsera.');
        setDiagnostics(verification.reasons);
        return;
      }
      setAnalysis(result);
      setFileMeta({ file, hash, verification });

      const preferredGroups = normalizeStudyGroupSelectionForAvailableGroups(
        result.groups,
        canonicalizeStudyGroupSelection((profileGroups.length ? profileGroups : activeImport?.selectedGroups ?? []).filter((group) => result.groups.includes(group))),
      );
      if (!result.groups.length) {
        preparePreview(result, []);
        return;
      }
      if (result.groups.length === 1) {
        preparePreview(result, [result.groups[0]!]);
        return;
      }
      const rememberedValidation = validateStudyGroupSelection(result.groups, preferredGroups);
      if (preferredGroups.length && rememberedValidation.valid) {
        preparePreview(result, preferredGroups);
        return;
      }
      setSelectedGroups(preferredGroups);
      setPhase('groups');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się przeanalizować planu.');
    } finally {
      setParsing(false);
    }
  }

  function preparePreview(sourceAnalysis: ScheduleAnalysis, groups: string[]) {
    const normalizedGroups = normalizeStudyGroupSelectionForAvailableGroups(sourceAnalysis.groups, groups);
    const groupValidation = validateStudyGroupSelection(sourceAnalysis.groups, normalizedGroups);
    if (!groupValidation.valid) {
      setError(groupValidation.errors.join(' '));
      return;
    }
    const filtered = candidatesForSelectedGroups(sourceAnalysis, normalizedGroups).map((candidate) => {
      const identified = identifyCandidate(candidate);
      return { ...identified, include: defaultIncludeForCandidate(identified) };
    });
    setSelectedGroups(normalizedGroups);
    setWorkingCandidates(filtered);
    setPendingCorrectionRules([]);
    setPreviewFilter('all');
    setError('');
    setPhase('preview');
  }

  function goToPreview() {
    if (!analysis) return;
    preparePreview(analysis, selectedGroups);
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
  const warningPreviewCount = useMemo(() => workingCandidates.filter((candidate) => reviewCandidate(candidate).state === 'WARNING').length, [workingCandidates]);
  const incompletePreviewCount = useMemo(() => workingCandidates.filter((candidate) => reviewCandidate(candidate).state === 'INCOMPLETE').length, [workingCandidates]);
  const blockingPreviewCount = useMemo(() => workingCandidates.filter((candidate) => reviewCandidate(candidate).state === 'BLOCKING').length, [workingCandidates]);
  const selectedWarningCount = useMemo(() => workingCandidates.filter((candidate) => candidate.include && reviewCandidate(candidate).state === 'WARNING').length, [workingCandidates]);
  const manuallyExcludedCount = useMemo(() => workingCandidates.filter((candidate) => !candidate.include && reviewCandidate(candidate).canImport).length, [workingCandidates]);
  const reviewedCount = workingCandidates.filter((candidate) => candidate.manuallyReviewed && candidate.include).length;

  async function continueAfterPreview() {
    if (!analysis || !fileMeta || invalidIncluded.length || !importable.length) return;
    if (!activeImport) {
      await confirmImport();
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
  const schedulePeriod = formatSchedulePeriod(workingCandidates);
  const attentionCount = warningPreviewCount + incompletePreviewCount + blockingPreviewCount;
  const importBlocked = Boolean(selectedCompleteness && !selectedCompleteness.safe) || invalidIncluded.length > 0 || !importable.length;
  const selectedGroupSummary = formatStudyGroupList(selectedGroups) || 'Wspólne / bez grup';
  const groupChoiceProgress = analysis ? studyGroupChoiceProgress(analysis.groups, selectedGroups) : { completed: 0, required: 0 };
  const activePlanUpdate = activeImport && latestAppliedUpdate?.newFileHash === activeImport.fileHash ? latestAppliedUpdate : null;

  return (
    <section className="view-shell study-view">
      <header className="view-header hero-header study-hero-simple">
        <div><h1>Studia</h1></div>
        <div className="view-header-actions">
          {phase !== 'idle' && phase !== 'groups' ? <button type="button" className="button button-secondary" onClick={() => resetFlow()}>Anuluj import</button> : null}
        </div>
      </header>

      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}
      {diagnostics.length ? <section className="diagnostics-card"><div className="diagnostics-card-heading"><strong>Szczegóły</strong></div><div className="diagnostics-card-body">{diagnostics.map((line) => <span key={line}>{line}</span>)}</div></section> : null}

      {phase === 'idle' ? (
        <div className={dragActive ? 'upload-panel study-upload-simple study-upload-dashboard panel drag-active' : 'upload-panel study-upload-simple study-upload-dashboard panel'} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}>
          <div className="study-upload-copy">
            <h2>Plan zajęć</h2>
            {!activeImport ? <p>Wczytaj plik XLSX lub XLS.</p> : null}
            {activeImport ? (
              <div className="study-current-plan-line" aria-label="Status aktualnego planu studiów">
                <div className="study-current-plan-main"><strong>{activeImport.fileName}</strong><small>{activeImport.importedEventCount} wydarzeń · {formatImportDate(activeImport.importedAt)}</small></div>
                {activePlanUpdate ? <span className="study-current-plan-change" title={activePlanUpdate.appliedAt ? formatImportDate(activePlanUpdate.appliedAt) : undefined}>{formatUpdateSummary(activePlanUpdate.summary)}</span> : null}
              </div>
            ) : null}
            {!activeImport ? <span className="upload-hint">Możesz też przeciągnąć plik tutaj.</span> : null}
          </div>
          <div className="study-upload-action">
            <input ref={fileInputRef} className="visually-hidden" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => { const file = event.target.files?.[0]; if (file) void processFile(file); }} />
            <button type="button" className="button button-primary study-upload-primary" disabled={parsing} onClick={() => fileInputRef.current?.click()}>{parsing ? 'Sprawdzam...' : activeImport ? 'Wczytaj nowy' : 'Wczytaj plan'}</button>
          </div>
        </div>
      ) : null}

      {phase === 'groups' && analysis ? (
        <section className="panel group-panel study-group-simple form-flow-panel">
          <div className="panel-heading">
            <div><p className="section-kicker">Grupy</p><h2>Wybierz swoje grupy</h2></div>
            <span className={groupSelectionValidation.valid ? 'selection-progress is-complete' : 'selection-progress'}>{groupSelectionValidation.valid ? 'Wybór kompletny' : `${groupChoiceProgress.completed} z ${groupChoiceProgress.required} wymaganych`}</span>
          </div>
          <p className="panel-copy">Wskaż tylko niezależne przypisania. Dokładniejsza podgrupa automatycznie obejmie szerszy podział.</p>
          <div className="form-flow-body">
            <StudyGroupChoiceFields availableGroups={analysis.groups} selectedGroups={selectedGroups} onChange={setSelectedGroups} ariaLabel="Wybór grup do importu" />
            {!groupSelectionValidation.valid ? <div className="inline-validation warning" role="status"><strong>Uzupełnij wybór</strong><span>{groupSelectionValidation.errors.join(' ')}</span></div> : null}
            <section className="context-note"><strong>Jak aplikacja łączy grupy?</strong><p>Grupa 4-osobowa automatycznie obejmuje odpowiadającą jej grupę 8-osobową i grupę główną. Grupę 12-osobową wybierasz osobno.</p></section>
          </div>
          <footer className="panel-action-footer"><button type="button" className="button button-secondary" onClick={() => resetFlow()}>Wybierz inny plik</button><button type="button" className="button button-primary" disabled={!groupSelectionValidation.valid} onClick={goToPreview}>Pokaż mój plan</button></footer>
        </section>
      ) : null}

      {phase === 'preview' && analysis && fileMeta ? (
        <div className="study-stack">
          <section className="panel study-import-summary study-import-summary-v207">
            <div className="study-import-summary-heading">
              <div><h2>{importBlocked ? 'Plan wymaga sprawdzenia' : 'Plan gotowy'}</h2><p>{fileMeta.file.name}</p></div>
              {importBlocked ? <span className="study-summary-state blocking">WYMAGA POPRAWY</span> : fileMeta.verification.state === 'VERIFIED_REFERENCE' ? <span className="study-summary-state ready">ZWERYFIKOWANY</span> : null}
            </div>
            <div className="study-import-summary-line-v207" aria-label="Podsumowanie importu">
              <strong>{importable.length} wydarzeń</strong>
              <span>{schedulePeriod}</span>
              <span>{selectedGroupSummary}</span>
            </div>
            {selectedCompleteness && !selectedCompleteness.safe ? <div className="study-summary-alert blocking"><strong>Nie można jeszcze dodać planu.</strong><span>{selectedCompleteness.reasons.join(' ')}</span></div> : null}
            {!importBlocked && incompletePreviewCount ? <div className="study-summary-note-v207"><strong>{incompletePreviewCount} niepełne</strong><span>Nie zostaną dodane.</span></div> : null}
            {!importBlocked && (warningPreviewCount || scheduleConflicts.length) ? <div className="study-summary-note-v207"><strong>{warningPreviewCount + scheduleConflicts.length} do sprawdzenia</strong><span>Szczegóły są poniżej.</span></div> : null}
            <footer className="study-import-summary-actions"><button type="button" className="button button-primary" disabled={importBlocked || saving} onClick={() => activeImport ? void continueAfterPreview() : void confirmImport()}>{saving ? 'Przygotowuję...' : activeImport ? 'Porównaj zmiany' : `Dodaj ${importable.length}`}</button></footer>
          </section>

          <details className="panel study-review-details study-review-details-v207" open={importBlocked ? true : undefined}>
            <summary><span><strong>Szczegóły</strong><small>{attentionCount ? `${attentionCount} uwag` : `${workingCandidates.length} wpisów`}</small></span><span className="study-details-action">Pokaż</span></summary>
            <div className="study-review-details-body">
              {analysis.information.length || analysis.warnings.length ? <details className="study-source-notes-v207"><summary><strong>Informacje z planu</strong><span>{analysis.information.length + analysis.warnings.length}</span></summary><div>{analysis.information.map((item) => <div key={item.id} className="study-information"><strong>{item.title}</strong><span>{item.message}</span></div>)}{analysis.warnings.map((warning) => <div key={warning} className="study-information warning-info">{warning}</div>)}</div></details> : null}
              {selectedCompleteness ? <details className="study-source-audit-v207" open={!selectedCompleteness.safe}><summary><strong>Kontrola źródła</strong><span>{selectedCompleteness.completeBlockCount}/{selectedCompleteness.sourceBlockCount} bloków · {selectedCompleteness.incompleteSourceBlockCount} niepełnych · godziny {strictHourAudits.filter((audit) => audit.status === 'MATCH').length}/{strictHourAudits.length}</span></summary><div className="study-source-audit-body-v207">{incompleteHourAudits.length ? <div className="study-completeness-note"><strong>{incompleteHourAudits.length} bilansów godzin jest niepełnych.</strong><span>Te pozycje pozostają tylko do wglądu.</span></div> : null}{advisoryHourInconsistencies.length ? <div className="study-completeness-note advisory"><strong>{advisoryHourInconsistencies.length} deklaracji godzin nie zgadza się z terminami.</strong><span>Zachowujemy daty i godziny z planu.</span></div> : null}{selectedCompleteness.reasons.length ? <div className="inline-error">{selectedCompleteness.reasons.join(' ')}</div> : null}</div></details> : null}

              <div className="preview-toolbar study-review-toolbar study-review-toolbar-v207"><div><h3>Wpisy</h3></div><div className="preview-filters" role="group" aria-label="Filtr wpisów"><button type="button" className={previewFilter === 'all' ? 'filter-button active' : 'filter-button'} onClick={() => setPreviewFilter('all')}>Wszystkie {workingCandidates.length}</button>{warningPreviewCount ? <button type="button" className={previewFilter === 'warning' ? 'filter-button active' : 'filter-button'} onClick={() => setPreviewFilter('warning')}>Do sprawdzenia {warningPreviewCount}</button> : null}{incompletePreviewCount ? <button type="button" className={previewFilter === 'incomplete' ? 'filter-button active' : 'filter-button'} onClick={() => setPreviewFilter('incomplete')}>Niepełne {incompletePreviewCount}</button> : null}{blockingPreviewCount ? <button type="button" className={previewFilter === 'blocking' ? 'filter-button active' : 'filter-button'} onClick={() => setPreviewFilter('blocking')}>Do poprawy {blockingPreviewCount}</button> : null}</div></div>
              <section className="preview-selection preview-selection-v207" aria-label="Wybór wpisów do importu"><div className="preview-selection-summary"><strong>{importable.length} wybranych</strong><span>{manuallyExcludedCount ? `${manuallyExcludedCount} pominiętych ręcznie` : 'Bezpieczne wpisy są już zaznaczone'}</span></div>{manuallyExcludedCount ? <button type="button" className="button button-secondary button-small" onClick={() => setWorkingCandidates((current) => selectAllImportable(current))}>Przywróć wybór</button> : null}</section>
              {scheduleConflicts.length ? <section className="confirm-warning conflict-review-panel"><div className="conflict-review-heading"><strong>Wykryto {scheduleConflicts.length} konfliktów godzin.</strong><span>Informacja</span></div><p>To mogą być błędy źródłowego planu albo świadomie nakładające się zajęcia. Konflikty pozostają widoczne, ale nie wymagają dodatkowego potwierdzenia - przejście dalej oznacza zapis wybranych wpisów zgodnie z planem.</p><ul className="study-conflict-list">{scheduleConflicts.slice(0, 8).map((conflict) => <li key={conflict.id}><time>{conflict.date}</time><span><strong>{conflict.left.subject}</strong> {conflict.left.startTime}-{conflict.left.endTime}</span><span className="conflict-separator">↔</span><span><strong>{conflict.right.subject}</strong> {conflict.right.startTime}-{conflict.right.endTime}</span></li>)}</ul>{scheduleConflicts.length > 8 ? <p>...oraz {scheduleConflicts.length - 8} kolejnych konfliktów.</p> : null}</section> : null}

              <div className="candidate-list study-review-candidate-list">
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
            </div>
          </details>
        </div>
      ) : null}

      {phase === 'diff' && updatePreview ? <ScheduleDiffView preview={updatePreview} saving={saving} onChange={setUpdatePreview} onApply={() => void applyUpdate()} onCancel={() => void cancelUpdate()} /> : null}

      {phase === 'idle' && (activeImport || profileGroups.length) ? <section className="study-groups-primary" aria-label="Wybór grup studiów"><StudyProfileSettings onDataChanged={async () => { await Promise.all([refreshStudyData(), onDataChanged()]); }} />{activeImport ? <StudyGroupPreviewPanel activeImport={activeImport} primaryGroups={profileGroups} /> : null}</section> : null}

      {phase === 'idle' && imports.length ? (
        <details className="imports-section study-history-details study-compact-details">
          <summary><span><strong>Historia planów</strong><small>{imports.length} {imports.length === 1 ? 'zapisany plan' : 'zapisane plany'}</small></span><span className="study-details-action">Pokaż</span></summary>
          <div className="import-history-grid study-history-compact-grid">
            {imports.map((item) => {
              const active = item.id === activeImport?.id || item.lifecycleStatus === 'ACTIVE';
              return <article key={item.id} className={`import-history-card${active ? ' active-import' : ''}`}><div><strong>{item.fileName}</strong><span>{formatImportDate(item.importedAt)}</span>{active ? <span className="active-plan-pill">AKTYWNY PLAN</span> : <span className="history-plan-pill">HISTORYCZNY</span>}</div><dl><div className="import-history-groups"><dt>Grupy</dt><dd>{item.selectedGroups.length ? <span className="import-history-group-list">{item.selectedGroups.map((group) => <i key={group} title={studyGroupDisplayLabel(group)}>{studyGroupCompactLabel(group)}</i>)}</span> : 'Wspólne / bez grup'}</dd></div><div><dt>Wydarzenia</dt><dd>{item.importedEventCount}</dd></div></dl><button type="button" className="text-button danger-text" onClick={() => void removeImport(item)}>{active ? 'Usuń aktywny plan' : 'Usuń zapis historyczny'}</button></article>;
            })}
          </div>
        </details>
      ) : null}
    </section>
  );
}
