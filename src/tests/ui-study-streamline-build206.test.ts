import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Build206 Study streamline', () => {
  it('replaces the preview wall of group tiles with the shared compact chooser', () => {
    const preview = source('../study/StudyGroupPreviewPanel.tsx');
    expect(preview).toContain("StudyGroupChoiceFields } from './StudyGroupChoiceFields'");
    expect(preview).toContain('ariaLabel="Grupy do podglądu"');
    expect(preview).not.toContain("StudyGroupSelector } from './StudyGroupSelector'");
    expect(preview).not.toContain('Grupy do sprawdzenia');
  });

  it('keeps secondary preview tools behind compact details', () => {
    const preview = source('../study/StudyGroupPreviewPanel.tsx');
    expect(preview).toContain('study-preview-compact-details-v206');
    expect(preview).toContain('Zapisane wybory');
    expect(preview).toContain('Zapisz ten wybór');
    expect(preview).toContain('Inny Excel');
  });

  it('removes duplicate and technical copy from the normal Study surface', () => {
    const view = source('../study/StudyView.tsx');
    const profile = source('../study/StudyProfileSettings.tsx');
    expect(view).toContain('{!activeImport ? <span className="upload-hint">');
    expect(profile).not.toContain("<span>{formatStudyGroupList(groupsDraft) || 'Wybierz swoje grupy'}</span>");
  });

  it('keeps desktop compact and mobile readable', () => {
    const css = source('../styles/interface-refinement.css');
    expect(css).toContain('1.2.0.206 - Studies aligned with the current low-noise interface standard.');
    expect(css).toContain('.study-preview-picker-v206 .study-group-choice-grid');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(css).toContain('@media (max-width: 820px)');
  });
});
