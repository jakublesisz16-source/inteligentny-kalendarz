import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Location } from '../locations/location.types';
import { getWorkProfile, saveWorkProfile } from '../storage/database';
import type { WorkProfile } from './work.types';

export interface WorkProfileEditorHandle {
  save: () => Promise<WorkProfile | undefined>;
}

interface WorkProfileEditorProps {
  locations: Location[];
  compact?: boolean;
  hideSubmit?: boolean;
  silentSuccess?: boolean;
  onSaved?: (profile: WorkProfile) => void | Promise<void>;
}

export const WorkProfileEditor = forwardRef<WorkProfileEditorHandle, WorkProfileEditorProps>(function WorkProfileEditor({ locations, compact = false, hideSubmit = false, silentSuccess = false, onSaved }, ref) {
  const [profile, setProfile] = useState<WorkProfile | undefined>(undefined);
  const [employeeMatchName, setEmployeeMatchName] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [workplaceName, setWorkplaceName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [storeCoworkers, setStoreCoworkers] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    const current = await getWorkProfile();
    setProfile(current);
    if (!current) return;
    setEmployeeMatchName(current.employeeMatchName);
    setEmployerName(current.employerName);
    setWorkplaceName(current.workplaceName);
    setLocationId(current.locationId ?? '');
    setStoreCoworkers(current.storeCoworkerSchedule);
  }

  async function save(): Promise<WorkProfile | undefined> {
    setError('');
    setMessage('');
    if (!employeeMatchName.trim()) {
      setError('Wpisz imię i nazwisko dokładnie tak, jak występuje w grafiku.');
      return undefined;
    }
    setSaving(true);
    try {
      const saved = await saveWorkProfile({
        employeeMatchName,
        employerName,
        workplaceName,
        storeCoworkerSchedule: storeCoworkers,
        ...(locationId ? { locationId } : {}),
      });
      setProfile(saved);
      if (!silentSuccess) setMessage('Profil pracy zapisano lokalnie.');
      await onSaved?.(saved);
      return saved;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać profilu pracy.');
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({ save }), [employeeMatchName, employerName, workplaceName, locationId, storeCoworkers, silentSuccess, onSaved]);

  return (
    <div className={compact ? 'work-profile-form compact' : 'work-profile-form'}>
      <div className="form-grid two-columns">
        <label className="field"><span>Pracodawca</span><input value={employerName} onChange={(e) => setEmployerName(e.target.value)} placeholder="Np. nazwa firmy" /></label>
        <label className="field"><span>Miejsce pracy</span><input value={workplaceName} onChange={(e) => setWorkplaceName(e.target.value)} placeholder="Np. nazwa sklepu / galerii" /></label>
      </div>
      <div className="form-grid two-columns">
        <label className="field"><span>Lokalizacja</span><select value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">Nie ustawiono</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="field"><span>Moje imię i nazwisko w grafiku</span><input value={employeeMatchName} onChange={(e) => setEmployeeMatchName(e.target.value)} placeholder="Dokładnie jak w PDF" /></label>
      </div>
      <label className="work-privacy-toggle"><input type="checkbox" checked={storeCoworkers} onChange={(e) => setStoreCoworkers(e.target.checked)} /><span><strong>Pokazuj kto jest ze mną na zmianie</strong><small>Po imporcie zapisujemy lokalnie tylko nazwę współpracownika i jego przedział pracy potrzebny do porównania zmian. Surowy PDF nie jest przechowywany.</small></span></label>
      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}
      {!hideSubmit ? <button type="button" className="button button-primary align-start" disabled={saving} onClick={() => void save()}>{saving ? 'Zapisywanie...' : profile ? 'Zapisz profil pracy' : 'Utwórz profil pracy'}</button> : null}
    </div>
  );
});
