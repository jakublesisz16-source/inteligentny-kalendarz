import { useEffect, useState } from 'react';
import {
  applyGroupRecalculation,
  getActiveUniversityImport,
  getStudyProfile,
  prepareGroupRecalculation,
  updateStudyProfileGroups,
} from '../storage/database';
import { formatStudyGroupList, studyGroupCompactLabel, studyGroupDisplayLabel } from '../imports/xlsx/group-normalizer';
import type { GroupRecalculationPreview, StudyProfile, UniversityScheduleImport } from './study.types';
import { StudyGroupSelector } from './StudyGroupSelector';

interface StudyProfileSettingsProps {
  onDataChanged: () => Promise<void>;
}

export function StudyProfileSettings({ onDataChanged }: StudyProfileSettingsProps) {
  const [profile, setProfile] = useState<StudyProfile | null>(null);
  const [activeImport, setActiveImport] = useState<UniversityScheduleImport | null>(null);
  const [editing, setEditing] = useState(false);
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

  function toggleGroup(group: string) {
    setGroupsDraft((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group]);
    setRecalculation(null); setMessage(''); setError('');
  }

  async function saveFutureGroups() {
    if (!groupsDraft.length) { setError('Wybierz co najmniej jedną grupę.'); return; }
    setSaving(true);
    try {
      const next = await updateStudyProfileGroups(groupsDraft);
      setProfile(next); setEditing(false); setRecalculation(null); setError('');
      setMessage('Grupy zapisano dla kolejnych importów. Aktualny kalendarz nie został zmieniony.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać grup.'); }
    finally { setSaving(false); }
  }

  async function previewRecalculation() {
    if (!groupsDraft.length) { setError('Wybierz co najmniej jedną grupę.'); return; }
    setSaving(true);
    try {
      const preview = await prepareGroupRecalculation(groupsDraft);
      setRecalculation(preview); setMessage('');
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
      setEditing(false); setRecalculation(null); setError(''); setMessage('Aktualny plan został przeliczony dla nowych grup.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się przeliczyć aktywnego planu.'); }
    finally { setSaving(false); }
  }

  const activeGroups = activeImport?.selectedGroups ?? [];
  const futureGroups = profile?.selectedGroups ?? activeGroups;
  const futureGroupsDiffer = [...futureGroups].sort().join('|') !== [...activeGroups].sort().join('|');
  const availableGroups = profile?.availableGroups ?? activeImport?.availableGroups ?? profile?.selectedGroups ?? [];
  if (!profile && !activeImport) return null;

  return <details className="panel study-profile-settings">
    <summary><span><span className="section-kicker">Moje studia</span><strong>Grupy i aktywny plan</strong></span><span className="selected-group-row compact">{activeGroups.map((group) => <i key={group}>{studyGroupDisplayLabel(group)}</i>)}</span></summary>
    <div className="study-profile-settings-body">
      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}
      <div className="study-profile-summary minimal">
        <div><span>Aktywny plan</span><strong>{activeImport?.fileName ?? 'Brak'}</strong></div>
        <div><span>Grupy aktywnego planu</span><span className="study-profile-group-chips">{activeGroups.length ? activeGroups.map((group) => <i key={group} title={studyGroupDisplayLabel(group)}>{studyGroupCompactLabel(group)}</i>) : <strong>Brak</strong>}</span></div>
      </div>
      {futureGroupsDiffer ? <div className="study-future-groups-note"><span>Dla kolejnych importów</span><strong>{formatStudyGroupList(futureGroups)}</strong></div> : null}
      {!editing ? <button type="button" className="button button-secondary button-small" onClick={() => setEditing(true)}>Zmień grupy</button> : <div className="settings-group-editor">
        <StudyGroupSelector groups={availableGroups} selectedGroups={groupsDraft} onToggle={toggleGroup} compact />
        <p className="muted-copy">Możesz zapisać wybór dla przyszłych importów albo najpierw sprawdzić wpływ na aktywny plan.</p>
        <div className="settings-study-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={() => { setEditing(false); setGroupsDraft(profile?.selectedGroups ?? activeImport?.selectedGroups ?? []); setRecalculation(null); }}>Anuluj</button><button type="button" className="button button-secondary" disabled={saving} onClick={() => void saveFutureGroups()}>Tylko kolejne importy</button><button type="button" className="button button-primary" disabled={saving} onClick={() => void previewRecalculation()}>Sprawdź aktualny plan</button></div>
      </div>}
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
  </details>;
}
