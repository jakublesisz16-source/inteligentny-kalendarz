import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const view = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../study/StudyProfileSettings.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.175 visible compact Study groups', () => {
  it('keeps the group picker directly on the Study surface', () => {
    expect(view).toContain('className="study-groups-primary"');
    expect(view).toContain('<StudyProfileSettings');
    expect(view).not.toContain('<details className="study-secondary-tools study-compact-details"');
  });

  it('removes duplicate plan copy and idle disabled actions from the group picker', () => {
    expect(profile).toContain('study-groups-visible-heading');
    expect(profile).toContain('id="study-profile-groups-title">Wybór grup</strong>');
    expect(profile).not.toContain('study-profile-plan-summary');
    expect(profile).not.toContain('Używamy tego samego, uproszczonego wyboru');
    expect(profile).toContain('draftDiffersFromFuture || draftDiffersFromActive ? <div className="settings-study-actions compact-study-actions">');
    expect(profile).toContain('Aktualny plan: {formatStudyGroupList(activeGroups)}');
    expect(profile).toContain('Kolejne importy: {formatStudyGroupList(futureGroups)}');
  });

  it('keeps desktop selectors compact and hides helper text only in the persistent picker', () => {
    expect(styles).toContain('1.2.0.175 - Study group choice stays visible while remaining compact.');
    expect(styles).toContain('.study-profile-group-picker .study-group-choice-grid {');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(styles).toContain('.study-profile-group-picker .study-group-choice-card small { display: none; }');
  });

  it('uses label/select rows on phones instead of tall stacked cards', () => {
    expect(responsive).toContain('1.2.0.175 - visible Study groups become compact label/select rows on phones.');
    expect(responsive).toContain('grid-template-columns: minmax(102px, .78fr) minmax(0, 1.22fr);');
    expect(responsive).toContain('.study-profile-group-picker .study-group-choice-card select { min-height: 44px; }');
  });

  it('does not require a database migration', () => {
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
