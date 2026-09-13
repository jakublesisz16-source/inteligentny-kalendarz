import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const studyProfile = readFileSync(new URL('../study/StudyProfileSettings.tsx', import.meta.url), 'utf8');
const studyPreview = readFileSync(new URL('../study/StudyGroupPreviewPanel.tsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../settings/SettingsView.tsx', import.meta.url), 'utf8');
const transfer = readFileSync(new URL('../data-transfer/DataTransferPanel.tsx', import.meta.url), 'utf8');
const safety = readFileSync(new URL('../safety/SafetyCenter.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.101 compact Studies and Settings', () => {
  it('keeps the real Study group selector permanently visible', () => {
    expect(studyProfile).toContain('study-profile-settings-always-open');
    expect(studyProfile).toContain('study-profile-group-picker');
    expect(studyProfile).toContain('study-group-dashboard');
    expect(studyProfile).toContain('Wybór grup');
    expect(studyProfile).not.toContain('Zmień grupy');
    expect(studyProfile).not.toContain('setEditing');
  });

  it('removes unnecessary nested Study and Settings panels', () => {
    expect(studyPreview).toContain('<section className="study-preview-sandbox">');
    expect(studyPreview).not.toContain('<section className="panel study-preview-sandbox">');
    expect(safety).toContain('<section className="safety-center">');
    expect(safety).not.toContain('<section className="panel safety-center">');
    expect(settings).toContain('Backup i przenoszenie');
    expect(settings).toContain('Dane i historia');
  });

  it('keeps safety information available without occupying the default layout', () => {
    expect(transfer).toContain('<details className="data-transfer-privacy-details">');
    expect(transfer).toContain('Informacje o bezpieczeństwie eksportu');
    expect(styles).toContain('/* 1.2.0.101 - compact Studies and Settings without hiding primary controls. */');
    expect(styles).toContain('.study-profile-group-picker .group-chip { min-height: 38px;');
    expect(styles).toContain('.study-profile-group-picker .group-chip { min-height: 42px;');
  });

  it('does not require a database migration', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
