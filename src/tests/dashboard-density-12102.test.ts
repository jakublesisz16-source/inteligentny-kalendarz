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

  it('keeps Work and Settings default surfaces flat and compact', () => {
    expect(work).toContain('className="work-overview-simple"');
    expect(work).toContain('work-shift-row-minimal');
    expect(settings).toContain('className="settings-core"');
    expect(settings).toContain('settings-collapsible-section');
    expect(styles).toContain('.work-overview-simple');
    expect(styles).toContain('.settings-collapsible-section');
  });

  it('keeps readable mobile controls while reducing visible information', () => {
    expect(styles).toContain('.study-group-choice-card select { min-height: 44px; }');
    expect(styles).toContain('.work-shift-row-minimal { gap: 6px; padding-block: 10px; }');
    expect(styles).toContain('.settings-core .settings-essential-grid {');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr);');
  });

  it('does not require a database migration', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
