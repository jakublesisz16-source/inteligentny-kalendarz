import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const studyView = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
const studyProfile = readFileSync(new URL('../study/StudyProfileSettings.tsx', import.meta.url), 'utf8');
const choiceFields = readFileSync(new URL('../study/StudyGroupChoiceFields.tsx', import.meta.url), 'utf8');
const normalizer = readFileSync(new URL('../imports/xlsx/group-normalizer.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');

describe('1.2.0.146 shared Study group choice', () => {
  it('uses one shared compact group chooser in import and profile settings', () => {
    expect(studyView).not.toContain('study-import-group-grid-desktop');
    expect(studyView).toContain('<StudyGroupChoiceFields');
    expect(studyProfile).toContain('<StudyGroupChoiceFields');
    expect(choiceFields).toContain('study-group-choice-grid');
    expect(styles).toContain('.study-group-choice-grid {\n  display: grid;');
  });

  it('hides redundant G8 whenever the selected main group exposes exact G4 choices', () => {
    expect(choiceFields).toContain("if (partition.kind === 'G8' && hasG4ForMain) return [];");
    expect(choiceFields).toContain("if (partition.kind === 'G4' && !hasG4ForMain) return [];");
    expect(choiceFields).toContain("{ kind: 'G4', label: 'Grupa 4-osobowa', helper: 'Wyznacza też grupę 8-osobową' }");
    expect(normalizer).toContain('normalizeStudyGroupSelectionForAvailableGroups');
    expect(normalizer).toContain("group.kind === 'G4' && group.number");
  });

  it('keeps G8 available for plans that do not expose a G4 partition', () => {
    expect(choiceFields).toContain("{ kind: 'G8', label: 'Grupa 8-osobowa', helper: 'Tylko gdy plan nie ma podziału 4-os.' }");
    expect(choiceFields).toContain("if (partition.kind === 'G8' && hasG4ForMain) return [];");
  });

  it('uses compact global form-flow primitives instead of nested field cards', () => {
    expect(studyView).toContain('form-flow-panel');
    expect(studyView).toContain('selection-progress');
    expect(studyView).toContain('inline-validation warning');
    expect(studyView).toContain('panel-action-footer');
    expect(styles).toContain('.panel-action-footer {');
    expect(styles).toContain('.context-note {');
  });
});
