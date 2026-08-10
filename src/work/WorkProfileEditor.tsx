import { useEffect, useState } from 'react';
import type { Location } from '../locations/location.types';
import { getWorkProfile, saveWorkProfile } from '../storage/database';
import type { WorkProfile } from './work.types';

interface WorkProfileEditorProps {
  locations: Location[];
  compact?: boolean;
  onSaved?: (profile: WorkProfile) => void | Promise<void>;
}

export function WorkProfileEditor({ locations, compact = false, onSaved }: WorkProfileEditorProps) {
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!employeeMatchName.trim()) { setError('Wpisz imię i nazwisko dokładnie tak, jak występuje w grafiku.'); return; }
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
      setMessage('Profil pracy zapisano lokalnie.');
      await onSaved?.(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać profilu pracy.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={compact ? 'work-profile-form compact' : 'work-profile-form'} onSubmit={submit}>
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
      <button type="submit" className="button button-primary align-start" disabled={saving}>{saving ? 'Zapisywanie...' : profile ? 'Zapisz profil pracy' : 'Utwórz profil pracy'}</button>
    </form>
  );
}
