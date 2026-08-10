import { useEffect, useState } from 'react';
import {
  applyGroupRecalculation,
  getActiveUniversityImport,
  getStudyProfile,
  prepareGroupRecalculation,
  updateStudyProfileGroups,
} from '../storage/database';
import type { GroupRecalculationPreview, StudyProfile, UniversityScheduleImport } from './study.types';

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
      setError(preview.requiresReupload ? preview.reason ?? 'Do przeliczenia potrzebny jest ponowny import XLSX.' : '');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się przygotować przeliczenia grup.'); }
    finally { setSaving(false); }
  }

  async function applyRecalculationNow() {
    if (!recalculation?.canRecalculate) return;
    setSaving(true);
    try {
      await applyGroupRecalculation(recalculation);
      await Promise.all([refresh(), onDataChanged()]);
      setEditing(false); setRecalculation(null); setError(''); setMessage('Aktualny plan został przeliczony dla nowych grup.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się przeliczyć aktywnego planu.'); }
    finally { setSaving(false); }
  }

  const availableGroups = profile?.availableGroups ?? activeImport?.availableGroups ?? profile?.selectedGroups ?? [];
  if (!profile && !activeImport) return null;

  return <details className="panel study-profile-settings">
    <summary><span><span className="section-kicker">Moje studia</span><strong>Grupy i aktywny plan</strong></span><span className="selected-group-row compact">{(profile?.selectedGroups ?? activeImport?.selectedGroups ?? []).map((group) => <i key={group}>{group}</i>)}</span></summary>
    <div className="study-profile-settings-body">
      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}
      <div className="study-profile-summary minimal"><div><span>Aktywny plan</span><strong>{activeImport?.fileName ?? 'Brak'}</strong></div><div><span>Moje grupy</span><strong>{(profile?.selectedGroups ?? activeImport?.selectedGroups ?? []).join(', ') || 'Brak'}</strong></div></div>
      {!editing ? <button type="button" className="button button-secondary button-small" onClick={() => setEditing(true)}>Zmień grupy</button> : <div className="settings-group-editor">
        <div className="group-grid compact-group-grid">{availableGroups.map((group) => <label key={group} className={groupsDraft.includes(group) ? 'group-chip selected' : 'group-chip'}><input type="checkbox" checked={groupsDraft.includes(group)} onChange={() => toggleGroup(group)} /><span>{group}</span></label>)}</div>
        <p className="muted-copy">Możesz zapisać wybór dla przyszłych importów albo najpierw sprawdzić wpływ na aktywny plan.</p>
        <div className="settings-study-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={() => { setEditing(false); setGroupsDraft(profile?.selectedGroups ?? activeImport?.selectedGroups ?? []); setRecalculation(null); }}>Anuluj</button><button type="button" className="button button-secondary" disabled={saving} onClick={() => void saveFutureGroups()}>Tylko kolejne importy</button><button type="button" className="button button-primary" disabled={saving} onClick={() => void previewRecalculation()}>Sprawdź aktualny plan</button></div>
      </div>}
      {recalculation ? <div className="group-recalc-preview"><strong>Wpływ zmiany</strong>{recalculation.requiresReupload ? <p>{recalculation.reason}</p> : <><div className="group-recalc-metrics"><span>Dodane <strong>+{recalculation.addedEntryIds.length}</strong></span><span>Usunięte <strong>-{recalculation.removedEntryIds.length}</strong></span><span>Bez zmian <strong>{recalculation.unchangedEventCount}</strong></span>{recalculation.protectedRemovedEventIds?.length ? <span>Zachowane ręczne <strong>{recalculation.protectedRemovedEventIds.length}</strong></span> : null}</div><button type="button" className="button button-primary button-small" disabled={saving} onClick={() => void applyRecalculationNow()}>Zastosuj</button></>}</div> : null}
    </div>
  </details>;
}
