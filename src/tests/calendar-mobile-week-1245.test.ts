import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.2.0.45 mobile weekly planner', () => {
  it('keeps all seven day selectors visible but renders only the selected timeline on phones', () => {
    const responsive = source('../styles/responsive.css');
    expect(responsive).toContain('1.2.0.45 - mobile-first weekly planner');
    expect(responsive).toContain('grid-template-columns: repeat(7, minmax(0, 1fr));');
    expect(responsive).toContain('.calendar-week-column { display: none; }');
    expect(responsive).toContain('.calendar-week-column.selected');
    expect(responsive).toContain('.calendar-week-all-day-cell { display: none; }');
    expect(responsive).toContain('.calendar-week-all-day-cell.selected');
  });

  it('keeps the phone timeline vertically scrollable and touch-friendly', () => {
    const responsive = source('../styles/responsive.css');
    expect(responsive).toContain('height: min(68dvh, 650px);');
    expect(responsive).toContain('overflow-y: auto;');
    expect(responsive).toContain('-webkit-overflow-scrolling: touch;');
    expect(responsive).toContain('width: min(286px, calc(100% - 8px));');
    expect(responsive).toContain('min-height: 42px;');
  });

  it('ships a dependency-free visual QA capture helper for desktop and mobile widths', () => {
    const pkg = JSON.parse(source('../../package.json')) as { scripts?: Record<string, string> };
    const script = source('../../scripts/visual-qa-capture.mjs');
    expect(pkg.scripts?.['visual:qa']).toContain('visual-qa-capture.mjs');
    expect(script).toContain('calendar-week-desktop-1440x1000.png');
    expect(script).toContain('calendar-week-mobile-390x844.png');
    expect(script).toContain('calendar-week-mobile-360x800.png');
  });

  it('keeps the schema unchanged', () => {
    const version = source('../core/version.ts');
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
