import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.2.0.25 Today balanced layout', () => {
  it('keeps the content-sized plan panel introduced in 1.2.0.24', () => {
    const today = source('../calendar/TodayView.tsx');
    const components = source('../styles/components.css');
    expect(today).toContain("hasPlan ? ' today-plan-panel today-single-surface' : ' today-empty-panel'");
    expect(components).toContain('.today-plan-panel {');
    expect(components).toContain('min-height: 0;');
  });

  it('uses a readable but bounded coworker area instead of a tiny left-side block', () => {
    const components = source('../styles/components.css');
    expect(components).toContain('1.2.0.25 - Today balance');
    expect(components).toContain('width: min(100%, 560px);');
    expect(components).toContain('grid-template-columns: minmax(230px, 1fr) minmax(118px, auto);');
    expect(components).toContain('font-size: .75rem;');
    expect(components).toContain('font-size: .69rem;');
  });

  it('keeps all coworkers visible and actions grouped without changing the event data flow', () => {
    const today = source('../calendar/TodayView.tsx');
    const components = source('../styles/components.css');
    const responsive = source('../styles/responsive.css');
    expect(today).toContain('showAllWorkCoworkers');
    expect(components).toContain('.today-plan-panel .event-actions-column');
    expect(components).toContain('font-size: .82rem;');
    expect(responsive).toContain('1.2.0.25 - Today balance');
  });

  it('keeps the private version and database schema synchronized', () => {
    const version = source('../core/version.ts');
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
