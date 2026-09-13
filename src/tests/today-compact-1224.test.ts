import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.2.0.24 Today compact layout', () => {
  it('lets the populated plan panel size to its content instead of the generic timeline minimum', () => {
    const today = source('../calendar/TodayView.tsx');
    const components = source('../styles/components.css');
    expect(today).toContain("hasPlan ? ' today-plan-panel today-single-surface' : ' today-empty-panel'");
    expect(components).toContain('.today-plan-panel {');
    expect(components).toContain('min-height: 0;');
  });

  it('keeps all coworkers visible but uses a compact name and overlap-time layout', () => {
    const today = source('../calendar/TodayView.tsx');
    const components = source('../styles/components.css');
    expect(today).toContain('showAllWorkCoworkers');
    expect(components).toContain('.today-plan-panel .event-coworker-line');
    expect(components).toContain('grid-template-columns: minmax(155px, 230px) auto;');
  });

  it('groups event actions and preserves the database schema', () => {
    const components = source('../styles/components.css');
    const responsive = source('../styles/responsive.css');
    const version = source('../core/version.ts');
    expect(components).toContain('1.2.0.24 - Today compact');
    expect(components).toContain('.today-plan-panel .event-actions-column');
    expect(responsive).toContain('1.2.0.24 - Today compact');
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
