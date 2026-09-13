import { useEffect, useState } from 'react';
import {
  applyGroupRecalculation,
  getActiveUniversityImport,
  getStudyProfile,
  prepareGroupRecalculation,
  updateStudyProfileGroups,
} from '../storage/database';
import { formatStudyGroupList, parseStudyGroupKey, studyGroupPlainLabel, type StudyGroupKind } from '../imports/xlsx/group-normalizer';
import type { GroupRecalculationPreview, StudyProfile, UniversityScheduleImport } from './study.types';
import { StudyGroupSelector } from './StudyGroupSelector';

const PROFILE_PARTITIONS: Array<{ kind: Exclude<StudyGroupKind, 'GENERIC'>; label: string; helper: string }> = [
  { kind: 'MAIN', label: 'Grupa główna', helper: 'Twoja grupa bazowa' },
  { kind: 'G12', label: '12-osobowa', helper: 'Niezależny podział zajęć' },
  { kind: 'G8', label: '8-osobowa', helper: 'Opcjonalna przy grupie 4-os.' },
  { kind: 'G4', label: '4-osobowa', helper: 'Najdokładniejsze przypisanie' },
];

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
    setProfile(loadedProfile ?? null);
    setActiveImport(active ?? null);
    setGroupsDraft(loadedProfile?.selectedGroups ?? active?.selectedGroups ?? []);
  }

  function resetFeedback() {
    setRecalculation(null);
    setMessage('');
    setError('');
  }

  function toggleGroup(group: string) {
    setGroupsDraft((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group]);
    resetFeedback();
  }

  function setPartitionGroup(kind: Exclude<StudyGroupKind, 'GENERIC'>, group: string) {
    setGroupsDraft((current) => {
      const chosen = group ? parseStudyGroupKey(group) : null;
      let next = current.filter((item) => parseStudyGroupKey(item).kind !== kind);
      if (chosen?.number) {
        next = next.filter((item) => {
          const parsed = parseStudyGroupKey(item);
          return parsed.kind === 'GENERIC' || !parsed.number || parsed.number === chosen.number;
        });
      }
      return group ? [...next, group] : next;
    });
    resetFeedback();
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

  const activeGroups = activeImport?.selectedGroups ?? [];
  const futureGroups = profile?.selectedGroups ?? activeGroups;
  const futureGroupsDiffer = !sameGroups(futureGroups, activeGroups);
  const draftDiffersFromFuture = !sameGroups(groupsDraft, futureGroups);
  const draftDiffersFromActive = !sameGroups(groupsDraft, activeGroups);
  const availableGroups = profile?.availableGroups ?? activeImport?.availableGroups ?? profile?.selectedGroups ?? [];
  const parsedAvailableGroups = availableGroups.map((group) => ({ key: group, parsed: parseStudyGroupKey(group) }));
  const hasStructuredGroups = parsedAvailableGroups.some(({ parsed }) => parsed.encoded && parsed.kind !== 'GENERIC');
  const parsedDraftGroups = groupsDraft.map(parseStudyGroupKey);
  const selectedMainNumber = parsedDraftGroups.find((group) => group.kind === 'MAIN' && group.number)?.number ?? parsedDraftGroups.find((group) => group.number)?.number;
  const genericGroups = parsedAvailableGroups.filter(({ parsed }) => parsed.kind === 'GENERIC').map(({ key }) => key);
  if (!profile && !activeImport) return null;

  return <section className="study-profile-settings study-profile-settings-always-open" aria-labelledby="study-profile-groups-title">
    <div className="study-profile-settings-heading">
      <div>
        <span className="section-kicker">Moje studia</span>
        <strong id="study-profile-groups-title">Grupy i aktywny plan</strong>
      </div>
      <span className="study-profile-heading-status">{activeGroups.length ? `${activeGroups.length} aktywne` : 'Brak grup'}</span>
    </div>

    <div className="study-profile-settings-body">
      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}

      <div className="study-profile-summary minimal study-profile-plan-summary">
        <div><span>Aktywny plan</span><strong>{activeImport?.fileName ?? 'Brak'}</strong></div>
      </div>

      {futureGroupsDiffer ? <div className="study-future-groups-note"><span>Dla kolejnych importów</span><strong>{formatStudyGroupList(futureGroups)}</strong></div> : null}

      <div className="study-profile-group-picker">
        <div className="settings-groups-heading">
          <div><strong>Wybór grup</strong><span>Zaznacz grupy, które dotyczą Ciebie.</span></div>
          <span>{groupsDraft.length} wybranych</span>
        </div>
        {availableGroups.length ? <>
          {hasStructuredGroups ? <div className="study-group-dashboard" aria-label="Stały wybór grup studiów">
            {PROFILE_PARTITIONS.map((partition) => {
              const options = parsedAvailableGroups.filter(({ parsed }) => parsed.kind === partition.kind && (partition.kind === 'MAIN' || !selectedMainNumber || parsed.number === selectedMainNumber));
              if (!options.length) return null;
              const current = groupsDraft.find((group) => parseStudyGroupKey(group).kind === partition.kind) ?? '';
              return <label key={partition.kind} className="study-group-dashboard-card">
                <span><strong>{partition.label}</strong><small>{partition.helper}</small></span>
                <select value={current} onChange={(event) => setPartitionGroup(partition.kind, event.target.value)} aria-label={`Wybierz: ${partition.label}`}>
                  <option value="">Nie wybrano</option>
                  {options.map(({ key }) => <option key={key} value={key}>{studyGroupPlainLabel(key)}</option>)}
                </select>
              </label>;
            })}
          </div> : null}
          {genericGroups.length ? <div className="study-generic-groups"><span>Pozostałe oznaczenia</span><StudyGroupSelector groups={genericGroups} selectedGroups={groupsDraft} onToggle={toggleGroup} compact /></div> : null}
        </> : <p className="muted-copy">Aktywny plan nie udostępnia osobnych grup do wyboru.</p>}
        <div className="settings-study-actions compact-study-actions">
          {draftDiffersFromFuture ? <button type="button" className="button button-secondary" disabled={saving} onClick={() => { setGroupsDraft(futureGroups); setRecalculation(null); setError(''); setMessage(''); }}>Przywróć zapisany wybór</button> : null}
          <button type="button" className="button button-secondary" disabled={saving || !groupsDraft.length || !draftDiffersFromFuture} onClick={() => void saveFutureGroups()}>Tylko kolejne importy</button>
          <button type="button" className="button button-primary" disabled={saving || !groupsDraft.length || !draftDiffersFromActive} onClick={() => void previewRecalculation()}>Sprawdź aktualny plan</button>
        </div>
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
