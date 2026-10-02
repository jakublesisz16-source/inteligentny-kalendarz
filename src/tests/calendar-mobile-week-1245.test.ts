import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('mobile weekly planner contract', () => {
  it('keeps all seven day timelines visible on phones', () => {
    const responsive = source('../styles/responsive.css');
    const refinement = source('../styles/interface-refinement.css');
    expect(responsive).toContain('1.2.0.45 - mobile-first weekly planner');
    expect(refinement).toContain('Build239 - mobile Week keeps the whole seven-day planner visible');
    expect(refinement).toContain('grid-template-columns: 32px repeat(7, minmax(0, 1fr));');
    expect(refinement).toContain('grid-template-columns: repeat(7, minmax(0, 1fr));');
    expect(refinement).toContain('.calendar-week-column,');
    expect(refinement).toContain('.calendar-week-all-day-cell,');
  });

  it('keeps the phone timeline in the natural page scroll and touch-friendly', () => {
    const responsive = source('../styles/responsive.css');
    const refinement = source('../styles/interface-refinement.css');
    expect(refinement).toContain('Build277 - mobile Week uses one natural page scroll');
    expect(refinement).toContain('height: auto !important;');
    expect(refinement).toContain('overflow-y: visible !important;');
    expect(refinement).toContain('touch-action: pan-y;');
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
