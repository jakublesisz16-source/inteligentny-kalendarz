import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('1.2.0.175 Study information hierarchy', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/study/StudyView.tsx'), 'utf8');

  it('keeps the active-plan action visible while moving infrequent tools one level deeper', () => {
    expect(source).toContain('study-upload-dashboard');
    expect(source).toContain('study-current-plan-line');
    expect(source).toContain('className="study-groups-primary"');
    expect(source).toContain('<details className="imports-section study-history-details study-compact-details"');
  });

  it('preserves groups, history and import-review access', () => {
    expect(source).toContain('StudyProfileSettings');
    expect(source).toContain('Historia planów');
    expect(source).toContain('Szczegóły i korekty');
    expect(source).toContain('StudyProfileSettings');
    expect(source).toContain('StudyGroupPreviewPanel');
  });
});
