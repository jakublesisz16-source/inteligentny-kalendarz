import { useEffect, useState } from 'react';
import {
  applyGroupRecalculation,
  getActiveUniversityImport,
  getStudyProfile,
  prepareGroupRecalculation,
  updateStudyProfileGroups,
} from '../storage/database';
import { canonicalizeStudyGroupSelection, formatStudyGroupList, normalizeStudyGroupSelectionForAvailableGroups } from '../imports/xlsx/group-normalizer';
import type { GroupRecalculationPreview, StudyProfile, UniversityScheduleImport } from './study.types';
import { StudyGroupChoiceFields, studyGroupChoiceProgress } from './StudyGroupChoiceFields';
import { validateStudyGroupSelection } from './study.service';

interface StudyProfileSettingsProps {
  onDataChanged: () => Promise<void>;
}

function sameGroups(left: string[], right: string[]) {
  return [...left].sort().join('|') === [...right].sort().join('|');
}

export function StudyProfileSettings({ onDataChanged }: StudyProfileSettingsProps) {
  const [profile, setProfile] = useState<StudyProfile | null>(null);
  const [activeImport, setActiveImport] = useState<UniversityScheduleImport | null>(null);
  const [groupsDraft, setGroupsDraft] = useState<string[]>([]);
  const [recalculation, setRecalculation] = useState<GroupRecalculationPreview | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    const [loadedProfile, active] = await Promise.all([getStudyProfile(), getActiveUniversityImport()]);
    const available = loadedProfile?.availableGroups ?? active?.availableGroups ?? loadedProfile?.selectedGroups ?? active?.selectedGroups ?? [];
    setProfile(loadedProfile ?? null);
    setActiveImport(active ?? null);
    setGroupsDraft(normalizeStudyGroupSelectionForAvailableGroups(available, loadedProfile?.selectedGroups ?? active?.selectedGroups ?? []));
  }

  function resetFeedback() {
    setRecalculation(null);
    setMessage('');
    setError('');
  }

  async function saveFutureGroups() {
    if (!groupsDraft.length) { setError('Wybierz co najmniej jedną grupę.'); return; }
    setSaving(true);
    try {
      const next = await updateStudyProfileGroups(groupsDraft);
      setProfile(next);
      setGroupsDraft(next.selectedGroups);
      setRecalculation(null);
      setError('');
      setMessage('Grupy zapisano dla kolejnych importów. Aktualny kalendarz nie został zmieniony.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać grup.'); }
    finally { setSaving(false); }
  }

  async function previewRecalculation() {
    if (!groupsDraft.length) { setError('Wybierz co najmniej jedną grupę.'); return; }
    setSaving(true);
    try {
      const preview = await prepareGroupRecalculation(groupsDraft);
      setRecalculation(preview);
      setMessage('');
      setError(preview.requiresReupload ? preview.reason ?? 'Do przeliczenia potrzebny jest ponowny import pliku Excel.' : '');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się przygotować przeliczenia grup.'); }
    finally { setSaving(false); }
  }

  async function applyRecalculationNow() {
    if (!recalculation?.canRecalculate) return;
    setSaving(true);
    try {
      await applyGroupRecalculation(recalculation, Boolean(recalculation.scheduleConflicts?.length), Boolean(recalculation.incompleteCandidates?.length));
      await Promise.all([refresh(), onDataChanged()]);
      setRecalculation(null);
      setError('');
      setMessage('Aktualny plan został przeliczony dla nowych grup.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się przeliczyć aktywnego planu.'); }
    finally { setSaving(false); }
  }

  const availableGroups = profile?.availableGroups ?? activeImport?.availableGroups ?? profile?.selectedGroups ?? [];
  const activeGroups = normalizeStudyGroupSelectionForAvailableGroups(availableGroups, canonicalizeStudyGroupSelection(activeImport?.selectedGroups ?? []));
  const futureGroups = normalizeStudyGroupSelectionForAvailableGroups(availableGroups, canonicalizeStudyGroupSelection(profile?.selectedGroups ?? activeGroups));
  const futureGroupsDiffer = !sameGroups(futureGroups, activeGroups);
  const draftDiffersFromFuture = !sameGroups(groupsDraft, futureGroups);
  const draftDiffersFromActive = !sameGroups(groupsDraft, activeGroups);
  const draftValidation = validateStudyGroupSelection(availableGroups, groupsDraft);
  const draftProgress = studyGroupChoiceProgress(availableGroups, groupsDraft);
  if (!profile && !activeImport) return null;

  return <section className="study-profile-settings study-profile-settings-always-open" aria-labelledby="study-profile-groups-title">
    <div className="study-profile-settings-heading study-groups-visible-heading">
      <div>
        <strong id="study-profile-groups-title">Wybór grup</strong>
      </div>
      {!draftValidation.valid ? <span className="study-profile-heading-status">{draftProgress.completed} z {draftProgress.required}</span> : null}
    </div>

    <div className="study-profile-settings-body">
      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}

      {futureGroupsDiffer ? <div className="study-future-groups-note"><span>Aktualny plan: {formatStudyGroupList(activeGroups)}</span><strong>Kolejne importy: {formatStudyGroupList(futureGroups)}</strong></div> : null}

      <div className="study-profile-group-picker">
        {availableGroups.length ? <StudyGroupChoiceFields availableGroups={availableGroups} selectedGroups={groupsDraft} onChange={(groups) => { setGroupsDraft(groups); resetFeedback(); }} ariaLabel="Stały wybór grup studiów" /> : <p className="muted-copy">Aktywny plan nie udostępnia osobnych grup do wyboru.</p>}
        {!draftValidation.valid && availableGroups.length ? <div className="inline-validation warning compact"><strong>Uzupełnij wybór</strong><span>{draftValidation.errors.join(' ')}</span></div> : null}
        {draftDiffersFromFuture || draftDiffersFromActive ? <div className="settings-study-actions compact-study-actions">
          {draftDiffersFromFuture ? <button type="button" className="button button-secondary" disabled={saving} onClick={() => { setGroupsDraft(futureGroups); setRecalculation(null); setError(''); setMessage(''); }}>Przywróć</button> : null}
          {draftDiffersFromFuture ? <button type="button" className="button button-secondary" disabled={saving || !draftValidation.valid} onClick={() => void saveFutureGroups()}>Tylko kolejne importy</button> : null}
          {draftDiffersFromActive ? <button type="button" className="button button-primary" disabled={saving || !draftValidation.valid} onClick={() => void previewRecalculation()}>Zastosuj do planu</button> : null}
        </div> : null}
      </div>

      {recalculation ? <div className="group-recalc-preview">
        <strong>Wpływ zmiany</strong>
        {recalculation.requiresReupload ? <p>{recalculation.reason}</p> : <>
          <div className="group-recalc-metrics">
            <span>Dodane <strong>+{recalculation.addedEntryIds.length}</strong></span>
            <span>Usunięte <strong>-{recalculation.removedEntryIds.length}</strong></span>
            <span>Bez zmian <strong>{recalculation.unchangedEventCount}</strong></span>
            {recalculation.protectedRemovedEventIds?.length ? <span>Zachowane ręczne <strong>{recalculation.protectedRemovedEventIds.length}</strong></span> : null}
            {recalculation.incompleteCandidates?.length ? <span>Niekompletne <strong>{recalculation.incompleteCandidates.length}</strong></span> : null}
          </div>
          {recalculation.incompleteCandidates?.length ? <div className="study-information warning-info">
            <strong>{recalculation.incompleteCandidates.length} wpisów nie ma pełnej daty lub godzin.</strong>
            <p>Nie zostaną wymyślone ani automatycznie dodane do kalendarza po zmianie grup.</p>
            <ul className="study-conflict-list compact">{recalculation.incompleteCandidates.slice(0, 6).map((candidate) => <li key={candidate.id}><time>{candidate.date ?? 'brak daty'}</time><span><strong>{candidate.subject}</strong> {candidate.startTime ?? '?'}-{candidate.endTime ?? '?'}</span></li>)}</ul>
            {recalculation.incompleteCandidates.length > 6 ? <p>...oraz {recalculation.incompleteCandidates.length - 6} kolejnych.</p> : null}
            <p>Możesz zastosować zmianę bez dodatkowego potwierdzenia. Te wpisy pozostaną widoczne jako niepełne i nie trafią do kalendarza, dopóki nie będą miały pełnych danych.</p>
          </div> : null}
          {recalculation.scheduleConflicts?.length ? <div className="study-information warning-info">
            <strong>Konflikty po zmianie grup: {recalculation.scheduleConflicts.length}.</strong>
            <ul className="study-conflict-list">{recalculation.scheduleConflicts.slice(0, 6).map((conflict) => <li key={conflict.id}><time>{conflict.date}</time><span><strong>{conflict.left.subject}</strong> {conflict.left.startTime}-{conflict.left.endTime}</span><span className="conflict-separator">↔</span><span><strong>{conflict.right.subject}</strong> {conflict.right.startTime}-{conflict.right.endTime}</span></li>)}</ul>
            {recalculation.scheduleConflicts.length > 6 ? <p>...oraz {recalculation.scheduleConflicts.length - 6} kolejnych.</p> : null}
            <p>Konflikty pozostają informacją. Kliknięcie „Zastosuj” zapisze wybrany wynik zmiany grup bez dodatkowego checkboxa.</p>
          </div> : null}
          <button type="button" className="button button-primary button-small" disabled={saving} onClick={() => void applyRecalculationNow()}>Zastosuj</button>
        </>}
      </div> : null}
    </div>
  </section>;
}
