import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.2.0.4 simplified Study import flow', () => {
  it('removes the separate technical analysis and duplicate confirmation phases', () => {
    const view = source('../study/StudyView.tsx');
    expect(view).toContain("type Phase = 'idle' | 'groups' | 'preview' | 'diff';");
    expect(view).not.toContain("phase === 'analysis'");
    expect(view).not.toContain("phase === 'confirm'");
    expect(view).not.toContain('Przejdź do potwierdzenia');
  });

  it('uses a single primary plan-loading action and detects Excel format behind it', () => {
    const view = source('../study/StudyView.tsx');
    expect(view).toContain("'Wczytaj plan'");
    expect(view).toContain('readSpreadsheetFile(file)');
    expect(view).toContain('accept=".xlsx,.xls');
    expect(view).not.toContain('Importuj Excel');
    expect(view).not.toContain('Wybierz nowy plan Excel');
  });

  it('skips group selection when it is unnecessary or a remembered selection remains valid', () => {
    const view = source('../study/StudyView.tsx');
    expect(view).toContain('if (!result.groups.length)');
    expect(view).toContain('if (result.groups.length === 1)');
    expect(view).toContain('rememberedValidation.valid');
    expect(view).toContain('preparePreview(result, preferredGroups)');
  });

  it('shows a compact summary before write and keeps detailed corrections available on demand', () => {
    const view = source('../study/StudyView.tsx');
    expect(view).toContain('className="panel study-import-summary"');
    expect(view).toContain('Do kalendarza');
    expect(view).toContain('Okres');
    expect(view).toContain('Niepełne');
    expect(view).toContain('Szczegóły i korekty');
    expect(view).toContain('Dodaj ${importable.length} do kalendarza');
  });

  it('does not weaken source completeness protection while simplifying the UI', () => {
    const view = source('../study/StudyView.tsx');
    expect(view).toContain('selectedCompleteness && !selectedCompleteness.safe');
    expect(view).toContain('Aplikacja nie zgaduje brakujących dni ani godzin.');
    expect(view).toContain('Kontrola kompletności');
    expect(source('../core/version.ts')).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
