import { useState } from 'react';
import type { Location, LocationDraft, LocationType } from './location.types';

interface LocationFormProps {
  location?: Location | undefined;
  onSubmit: (draft: LocationDraft) => Promise<void>;
  onDelete?: (() => Promise<void>) | undefined;
  onCancel: () => void;
}

const types: Array<{ value: LocationType; label: string }> = [
  { value: 'HOME_AREA', label: 'Obszar domowy' },
  { value: 'WORK', label: 'Praca' },
  { value: 'UNIVERSITY', label: 'Uczelnia' },
  { value: 'CLINIC', label: 'Klinika' },
  { value: 'OTHER', label: 'Inne' },
];

export function LocationForm({ location, onSubmit, onDelete, onCancel }: LocationFormProps) {
  const [name, setName] = useState(location?.name ?? '');
  const [type, setType] = useState<LocationType>(location?.type ?? 'OTHER');
  const [address, setAddress] = useState(location?.address ?? '');
  const [note, setNote] = useState(location?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setError('Nazwa i opis lokalizacji są wymagane.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name, type, address, ...(note.trim() ? { note } : {}) });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    if (!window.confirm('Usunąć to miejsce? Wydarzenia zachowają się, ale stracą przypisaną lokalizację.')) return;
    setSaving(true);
    try {
      await onDelete();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <label className="field full-field">
        <span>Nazwa</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="field full-field">
        <span>Typ</span>
        <select value={type} onChange={(e) => setType(e.target.value as LocationType)}>
          {types.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="field full-field">
        <span>Adres lub opis lokalizacji</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Np. ul. Testowa 1, Testowo" />
      </label>
      <label className="field full-field">
        <span>Notatka <em>opcjonalnie</em></span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </label>
      {error ? <small className="field-error block-error">{error}</small> : null}
      <footer className="modal-actions split-actions">
        <div>{onDelete ? <button type="button" className="button button-danger-ghost" onClick={remove} disabled={saving}>Usuń</button> : null}</div>
        <div className="action-group">
          <button type="button" className="button button-secondary" onClick={onCancel} disabled={saving}>Anuluj</button>
          <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Zapisywanie...' : 'Zapisz miejsce'}</button>
        </div>
      </footer>
    </form>
  );
}
