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

  it('shows MAIN, G12, G8 and G4 as independent choices when the Excel exposes them', () => {
    expect(choiceFields).toContain("{ kind: 'MAIN', label: 'Grupa główna', helper: '24-osobowa w obecnym planie' }");
    expect(choiceFields).toContain("{ kind: 'G12', label: 'Grupa 12-osobowa', helper: 'Niezależny przydział z planu' }");
    expect(choiceFields).toContain("{ kind: 'G8', label: 'Grupa 8-osobowa', helper: 'Niezależny przydział z planu' }");
    expect(choiceFields).toContain("{ kind: 'G4', label: 'Grupa 4-osobowa', helper: 'Niezależny przydział z planu' }");
    expect(choiceFields).not.toContain('hasG4ForMain');
    expect(normalizer).toContain('No cross-partition inference is allowed');
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
