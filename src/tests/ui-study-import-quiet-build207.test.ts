import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const view = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');

describe('Build207 quiet Study import review', () => {
  it('keeps the default decision surface short', () => {
    expect(view).toContain("'Plan gotowy'");
    expect(view).toContain('study-import-summary-line-v207');
    expect(view).toContain('`Dodaj ${importable.length}`');
    expect(view).not.toContain('study-import-other-file-v207');
    expect(view).not.toContain('>Do kalendarza</span><strong>');
    expect(view).not.toContain("'SPRAWDŹ UWAGI'");
    expect(view).not.toContain("'GOTOWY'");
  });

  it('moves diagnostics and per-entry review behind progressive disclosure', () => {
    expect(view).toContain('<details className="panel study-review-details study-review-details-v207"');
    expect(view).toContain('<strong>Szczegóły</strong>');
    expect(view).toContain('study-source-notes-v207');
    expect(view).toContain('study-source-audit-v207');
    expect(view).toContain('<strong>Kontrola źródła</strong>');
  });

  it('hides zero-value filters and removes redundant bulk controls', () => {
    expect(view).toContain('{warningPreviewCount ? <button');
    expect(view).toContain('{incompletePreviewCount ? <button');
    expect(view).toContain('{blockingPreviewCount ? <button');
    expect(view).not.toContain('Odznacz wszystkie');
    expect(view).not.toContain('Zaznacz wszystkie możliwe');
    expect(view).toContain('Przywróć wybór');
  });

  it('has dedicated compact desktop and mobile styling', () => {
    expect(css).toContain('.study-import-summary-v207');
    expect(css).toContain('.study-import-summary-line-v207');
    expect(css).toContain('.study-review-details-v207');
    expect(css).toContain('@media (max-width: 620px)');
  });
});
