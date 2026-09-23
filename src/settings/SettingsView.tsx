import { useState } from 'react';
import { BUILD_NUMBER } from '../core/build';
import { APP_RELEASE_VERSION } from '../core/version';
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

      <section className="settings-core" aria-label="Najważniejsze ustawienia aplikacji">
        <div className="settings-core-heading"><h2>Podstawy</h2></div>
        <div className="settings-essential-grid">
          <label className="field"><span>Ekran startowy</span><select value={settings.preferredStartView} onChange={(e) => onChange({ preferredStartView: e.target.value as StartView })}><option value="today">Dzisiaj</option><option value="calendar">Kalendarz</option></select></label>
          <label className="field"><span>Format czasu</span><select value={settings.timeFormat} onChange={(e) => onChange({ timeFormat: e.target.value as TimeFormat })}><option value="24h">24-godzinny</option><option value="12h">12-godzinny</option></select></label>
          <label className="field"><span>Obszar startowy</span><select value={settings.homeLocationId ?? ''} onChange={(e) => onChange({ homeLocationId: e.target.value || null })}><option value="">Nie ustawiono</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label className="field"><span>Miejsce pracy</span><select value={settings.workLocationId ?? ''} onChange={(e) => onChange({ workLocationId: e.target.value || null })}><option value="">Nie ustawiono</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        </div>
        <div className="settings-calendar-layers" aria-label="Warstwy informacyjne kalendarza">
          <span>Warstwy kalendarza</span>
          <label className="settings-layer-switch" title="Święta i dni ustawowo wolne w Polsce"><input type="checkbox" checked={settings.showPolishHolidays !== false} onChange={(event) => void onChange({ showPolishHolidays: event.target.checked })} /><span>Święta PL</span></label>
          <label className="settings-layer-switch" title="Oficjalny kalendarz akademicki WUM 2026/2027"><input type="checkbox" checked={settings.showWumAcademicCalendar !== false} onChange={(event) => void onChange({ showWumAcademicCalendar: event.target.checked })} /><span>WUM 26/27</span></label>
        </div>
        <PwaInstallPanel />
        <div className="settings-build-line" aria-label={`Wersja ${APP_RELEASE_VERSION}, build ${BUILD_NUMBER}`}>
          <span>{APP_RELEASE_VERSION}</span><i aria-hidden="true">·</i><span>Build {BUILD_NUMBER}</span>
        </div>
      </section>

      <div className="settings-secondary-list">
        <details className="settings-collapsible-section">
          <summary><span><strong>Kopia i przenoszenie</strong><small>Eksport, Excel, import</small></span><span className="settings-summary-action">Otwórz</span></summary>
          <div className="settings-collapsible-body"><DataTransferPanel onDataChanged={handleTransferDataChanged} /></div>
        </details>
        <details className="settings-collapsible-section">
          <summary><span><strong>Historia i odzyskiwanie</strong><small>Historia, Kosz, punkty</small></span><span className="settings-summary-action">Otwórz</span></summary>
          <div className="settings-collapsible-body"><SafetyCenter key={safetyRevision} onDataChanged={onDataChanged} /></div>
        </details>
      </div>
    </section>
  );
}
