import { useState } from 'react';
import { APP_VERSION, DATABASE_SCHEMA_VERSION } from '../core/version';
import type { Location } from '../locations/location.types';
import { SafetyCenter } from '../safety/SafetyCenter';
import { DataTransferPanel } from '../data-transfer/DataTransferPanel';
import { PwaInstallPanel } from './PwaInstallPanel';
import type { AppSettings, AppSettingsPatch, StartView, TimeFormat } from './settings.types';

interface SettingsViewProps {
  settings: AppSettings;
  locations: Location[];
  onChange: (patch: AppSettingsPatch) => Promise<void>;
  onDataChanged: () => Promise<void>;
}

export function SettingsView({ settings, locations, onChange, onDataChanged }: SettingsViewProps) {
  const [safetyRevision, setSafetyRevision] = useState(0);

  async function handleTransferDataChanged() {
    await onDataChanged();
    setSafetyRevision((value) => value + 1);
  }

  return (
    <section className="view-shell settings-minimal-view">
      <header className="view-header settings-compact-header">
        <div><h1>Ustawienia</h1></div>
      </header>

      <section className="panel settings-essential-card" aria-label="Najważniejsze ustawienia aplikacji">
        <div className="panel-heading compact-heading"><div><span className="section-kicker">Aplikacja</span><h2>Podstawy</h2></div></div>
        <div className="settings-essential-grid">
          <label className="field"><span>Ekran startowy</span><select value={settings.preferredStartView} onChange={(e) => onChange({ preferredStartView: e.target.value as StartView })}><option value="today">Dzisiaj</option><option value="calendar">Kalendarz</option></select></label>
          <label className="field"><span>Format czasu</span><select value={settings.timeFormat} onChange={(e) => onChange({ timeFormat: e.target.value as TimeFormat })}><option value="24h">24-godzinny</option><option value="12h">12-godzinny</option></select></label>
          <label className="field"><span>Obszar startowy</span><select value={settings.homeLocationId ?? ''} onChange={(e) => onChange({ homeLocationId: e.target.value || null })}><option value="">Nie ustawiono</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label className="field"><span>Miejsce pracy</span><select value={settings.workLocationId ?? ''} onChange={(e) => onChange({ workLocationId: e.target.value || null })}><option value="">Nie ustawiono</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        </div>
        <div className="settings-build-line" aria-label={`Wersja ${APP_VERSION}, schemat bazy ${DATABASE_SCHEMA_VERSION}, tryb lokalny`}>
          <span>Wersja {APP_VERSION}</span><i aria-hidden="true">·</i><span>Baza {DATABASE_SCHEMA_VERSION}</span><i aria-hidden="true">·</i><span>Lokalnie</span>
        </div>
        <PwaInstallPanel />
      </section>

      <section className="panel settings-section-card settings-advanced-transfer" aria-label="Backup i przenoszenie danych">
        <div className="panel-heading compact-heading"><div><span className="section-kicker">Dane</span><h2>Backup i przenoszenie</h2></div></div>
        <DataTransferPanel onDataChanged={handleTransferDataChanged} />
      </section>

      <section className="panel settings-section-card" aria-label="Dane i bezpieczeństwo">
        <div className="panel-heading compact-heading"><div><span className="section-kicker">Bezpieczeństwo</span><h2>Dane i historia</h2></div></div>
        <SafetyCenter key={safetyRevision} onDataChanged={onDataChanged} />
      </section>
    </section>
  );
}
