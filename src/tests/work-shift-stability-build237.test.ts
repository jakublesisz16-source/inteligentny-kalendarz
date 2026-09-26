import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const work = readFileSync(new URL('../work/WorkView.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');

describe('Build237 Work shift expansion stability', () => {
  it('keeps one controlled expansion without changing the trigger element type or geometry', () => {
    expect(work).toContain('expandedShiftId');
    expect(work).toContain('<button type="button" className="work-shift-row-trigger"');
    expect(work).toContain('aria-expanded={expanded}');
    expect(work).toContain('aria-controls={teamPanelId}');
    expect(work).toContain('current === event.id ? null : event.id');
    expect(work).not.toContain('<details className="work-shift-team-details work-shift-row-details"');
  });

  it('renders coworkers as a separate block below the stable row', () => {
    expect(work).toContain('className="work-shift-team-panel"');
    expect(work).toContain('{expanded ? <div id={teamPanelId} className="work-shift-team-panel"><CoworkerOverlapList');
  });

  it('reserves a fixed count column so opening the list cannot move the person-count control', () => {
    expect(css).toContain('--work-team-control-width: 104px;');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) var(--work-team-control-width);');
    expect(css).toContain('width: var(--work-team-control-width);');
    expect(css).toContain('min-width: var(--work-team-control-width);');
    expect(css).toContain('max-width: var(--work-team-control-width);');
    expect(css).toContain('--work-team-control-width: 84px;');
  });
});
