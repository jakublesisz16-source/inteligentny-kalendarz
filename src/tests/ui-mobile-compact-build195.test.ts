import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(new URL('../styles/index.css', import.meta.url), 'utf8');
const compactCss = readFileSync(new URL('../styles/mobile-compact.css', import.meta.url), 'utf8');
const today = readFileSync(new URL('../calendar/TodayView.tsx', import.meta.url), 'utf8');

describe('Build195 compact mobile surface system', () => {
  it('loads the compact mobile layer after the existing style stack', () => {
    expect(indexCss.indexOf("@import './mobile-compact.css';")).toBeGreaterThan(indexCss.indexOf("@import './interface-consistency.css';"));
  });

  it('keeps work shifts and settings as dense scan rows on phones', () => {
    expect(compactCss).toContain('.work-shift-row-minimal {\n    grid-template-columns: minmax(0, 1fr) auto;');
    expect(compactCss).toContain('.work-shift-main-line {\n    grid-template-columns: minmax(0, 1fr) auto auto;');
    expect(compactCss).toContain('.settings-minimal-view .settings-essential-grid .field {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr) minmax(150px, 56%);');
  });

  it('removes nested-card weight from Today, Work team details and consistency rows', () => {
    expect(compactCss).toContain('.today-view.has-plan .today-plan-panel.today-single-surface {\n    border: 0;');
    expect(compactCss).toContain('.coworker-overlap-row {\n    grid-template-columns: minmax(0, 1fr) auto;');
    expect(compactCss).toContain('.consistency-events > div {\n    grid-template-columns: 8px minmax(0, 1fr) auto;');
  });

  it('shortens the Today add action without changing its function', () => {
    expect(today).toContain('>+ Dodaj</button>');
    expect(today).not.toContain('>+ Dodaj wydarzenie</button>');
  });
});
