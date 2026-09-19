import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const study = readFileSync(new URL('../study/StudyProfileSettings.tsx', import.meta.url), 'utf8');
const studyView = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
const studyChoice = readFileSync(new URL('../study/StudyGroupChoiceFields.tsx', import.meta.url), 'utf8');
const work = readFileSync(new URL('../work/WorkView.tsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../settings/SettingsView.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.102 dashboard density', () => {
  it('keeps Study group choice visible without rendering the full option matrix', () => {
    expect(study).toContain('StudyGroupChoiceFields');
    expect(studyChoice).toContain('study-group-choice-grid');
    expect(studyChoice).toContain('study-group-choice-card');
    expect(studyChoice).toContain('<select value={current}');
    expect(studyChoice).toContain('setPartitionGroup');
    expect(studyView).toContain('study-upload-dashboard');
  });

  it('groups the compact Work and Settings overview modules into responsive dashboards', () => {
    expect(work).toContain('className="work-overview-dashboard"');
    expect(settings).toContain('className="settings-dashboard-grid"');
    expect(styles).toContain('.work-overview-dashboard');
    expect(styles).toContain('.settings-dashboard-grid');
  });

  it('keeps readable mobile controls while collapsing dashboard columns', () => {
    expect(styles).toContain('.study-group-choice-card select { min-height: 44px; }');
    expect(styles).toContain('.work-overview-dashboard { grid-template-columns: 1fr; }');
    expect(styles).toContain('.settings-minimal-view .settings-dashboard-grid .settings-essential-grid { grid-template-columns: 1fr; }');
  });

  it('does not require a database migration', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
