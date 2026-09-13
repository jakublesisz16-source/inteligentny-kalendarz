import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('1.2.0.5 Study information visibility', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/study/StudyView.tsx'), 'utf8');

  it('does not hide Study information in details accordions', () => {
    expect(source).not.toContain('<details');
    expect(source).not.toContain('<summary');
  });

  it('keeps groups, history and review sections directly visible', () => {
    expect(source).toContain('Grupy i podgląd');
    expect(source).toContain('Historia planów');
    expect(source).toContain('Szczegóły i korekty');
    expect(source).toContain('study-static-section-heading');
  });
});
