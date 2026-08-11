import { useState } from 'react';
import { APP_VERSION, DATABASE_SCHEMA_VERSION } from '../core/version';
import type { Location } from '../locations/location.types';
import { SafetyCenter } from '../safety/SafetyCenter';
import { DataTransferPanel } from '../data-transfer/DataTransferPanel';
import { PwaInstallPanel } from './PwaInstallPanel';
import { RELEASE_NOTES } from './releaseNotes';
import { USER_ROADMAP } from './roadmap';
import type { AppSettings, AppSettingsPatch, StartView, TimeFormat } from './settings.types';
import type { DecorativeBackgroundMode } from './appearance';

interface SettingsViewProps {
  settings: AppSettings;
  locations: Location[];
  onChange: (patch: AppSettingsPatch) => Promise<void>;
  onDataChanged: () => Promise<void>;
}

type ApplicationPanel = 'none' | 'changelog' | 'roadmap';

export function SettingsView({ settings, locations, onChange, onDataChanged }: SettingsViewProps) {
  const [applicationPanel, setApplicationPanel] = useState<ApplicationPanel>('none');
  const [safetyRevision, setSafetyRevision] = useState(0);

  async function handleTransferDataChanged() {
    await onDataChanged();
    setSafetyRevision((value) => value + 1);
  }

  return (
    <section className="view-shell settings-minimal-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Ustawienia</p>
          <h1>Prosto i lokalnie</h1>
          <p className="view-subtitle">Ustawienia pracy są teraz przy Pracy, a grupy przy Studiach. Tutaj zostają tylko rzeczy wspólne dla całej aplikacji.</p>
        </div>
      </header>

      <div className="settings-grid settings-grid-minimal">
        <section className="panel settings-card">
          <div className="panel-heading compact-heading"><div><span className="section-kicker">Aplikacja</span><h2>Podstawy</h2></div></div>
          <label className="field full-field"><span>Ekran startowy</span><select value={settings.preferredStartView} onChange={(e) => onChange({ preferredStartView: e.target.value as StartView })}><option value="today">Dzisiaj</option><option value="calendar">Kalendarz</option></select></label>
          <label className="field full-field"><span>Format czasu</span><select value={settings.timeFormat} onChange={(e) => onChange({ timeFormat: e.target.value as TimeFormat })}><option value="24h">24-godzinny</option><option value="12h">12-godzinny</option></select></label>
        </section>

        <section className="panel settings-card">
          <div className="panel-heading compact-heading"><div><span className="section-kicker">Wygląd</span><h2>Kwiatowy charakter</h2></div></div>
          <label className="field full-field"><span>Motyw kwiatowy</span><select value={settings.decorativeBackgroundMode} onChange={(e) => onChange({ decorativeBackgroundMode: e.target.value as DecorativeBackgroundMode })}><option value="off">Wyłączone</option><option value="static">Statyczne</option><option value="animated">Delikatnie animowane</option></select></label>
          <p className="settings-hint">Motyw kwiatowy tworzy wizualny charakter aplikacji. Możesz pozostawić go statyczny, włączyć bardzo delikatny ruch albo całkowicie wyłączyć. Przy systemowym ograniczeniu ruchu animacja automatycznie staje się statyczna.</p>
        </section>

        <section className="panel settings-card">
          <div className="panel-heading compact-heading"><div><span className="section-kicker">Lokalizacje</span><h2>Domyślne miejsca</h2></div></div>
          <label className="field full-field"><span>Obszar startowy</span><select value={settings.homeLocationId ?? ''} onChange={(e) => onChange({ homeLocationId: e.target.value || null })}><option value="">Nie ustawiono</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label className="field full-field"><span>Miejsce pracy</span><select value={settings.workLocationId ?? ''} onChange={(e) => onChange({ workLocationId: e.target.value || null })}><option value="">Nie ustawiono</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        </section>

        <section className="panel settings-card application-settings-card">
          <div className="panel-heading compact-heading"><div><span className="section-kicker">Wersja</span><h2>Inteligentny Kalendarz</h2></div></div>
          <div className="app-info-grid"><div><span>Wersja</span><strong>{APP_VERSION}</strong></div><div><span>Schemat bazy</span><strong>{DATABASE_SCHEMA_VERSION}</strong></div><div><span>Tryb</span><strong>Lokalny</strong></div></div>
          <div className="application-links"><button type="button" className={applicationPanel === 'changelog' ? 'button button-secondary active' : 'button button-secondary'} onClick={() => setApplicationPanel(applicationPanel === 'changelog' ? 'none' : 'changelog')}>Co nowego</button><button type="button" className={applicationPanel === 'roadmap' ? 'button button-secondary active' : 'button button-secondary'} onClick={() => setApplicationPanel(applicationPanel === 'roadmap' ? 'none' : 'roadmap')}>Roadmapa</button></div>
          <PwaInstallPanel />
        </section>
      </div>


      <section id="data-transfer-settings" className="panel settings-transfer-card" aria-label="Przenoszenie danych między urządzeniami">
        <DataTransferPanel onDataChanged={handleTransferDataChanged} />
      </section>

      <details className="panel settings-safety-collapsible">
        <summary><span><span className="section-kicker">Dane i bezpieczeństwo</span><strong>Trwałość danych, backup, Kosz i historia</strong></span><span className="muted-copy">Otwórz</span></summary>
        <SafetyCenter key={safetyRevision} onDataChanged={onDataChanged} />
      </details>

      {applicationPanel === 'changelog' ? <section className="panel info-drawer"><div className="panel-heading"><div><p className="section-kicker">Co nowego</p><h2>Historia zmian</h2></div></div><div className="release-list">{RELEASE_NOTES.map((release) => <article key={release.version} className="release-item"><div><span className="release-version">{release.version}</span><h3>{release.title}</h3></div><ul>{release.changes.map((change) => <li key={change}>{change}</li>)}</ul></article>)}</div></section> : null}

      {applicationPanel === 'roadmap' ? <section className="panel info-drawer"><div className="panel-heading"><div><p className="section-kicker">Roadmapa</p><h2>Co planujemy dalej</h2></div></div><p className="panel-copy roadmap-copy">Roadmapa pokazuje kierunek rozwoju, nie obiecuje terminów.</p><div className="roadmap-list">{USER_ROADMAP.map((item) => <article key={`${item.version}-${item.title}`} className="roadmap-item"><div className="roadmap-version"><strong>{item.version}</strong><span>{item.status === 'DONE' ? 'WYDANE' : item.status === 'NEXT' ? 'NASTĘPNIE' : 'PÓŹNIEJ'}</span></div><div><h3>{item.title}</h3><p>{item.description}</p>{item.features?.length ? <ul>{item.features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : null}</div></article>)}</div></section> : null}
    </section>
  );
}
