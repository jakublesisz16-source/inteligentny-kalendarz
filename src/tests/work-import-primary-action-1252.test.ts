import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const view = readFileSync('src/work/WorkView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.53 work import primary action', () => {
  it('shows the calendar commit action before long preview details', () => {
    const action = view.indexOf('Dodaj do kalendarza');
    const details = view.indexOf('Sprawdź szczegóły importu');
    expect(action).toBeGreaterThan(-1);
    expect(details).toBeGreaterThan(action);
    expect(view).toContain('work-analysis-primary-action');
  });

  it('keeps only essential metrics above the details disclosure', () => {
    expect(view).toContain('work-analysis-metrics-essential');
    expect(view).toContain('<span>Profil</span>');
    expect(view).toContain('<span>Zmiany</span>');
    expect(view).toContain('<span>Godziny</span>');
  });

  it('has dedicated mobile styling and does not change the database schema', () => {
    expect(css).toContain('1.2.0.53 - work import primary action is visible before preview details');
    expect(responsive).toContain('1.2.0.53 - keep Work import commit visible immediately on mobile');
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
