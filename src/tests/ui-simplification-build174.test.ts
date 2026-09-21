import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const study = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
const work = readFileSync(new URL('../work/WorkView.tsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../settings/SettingsView.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.174 minimal default surfaces', () => {
  it('keeps Study focused on the current plan and update action', () => {
    expect(study).toContain('<h1>Studia</h1>');
    expect(study).toContain('study-current-plan-line');
    expect(study).toContain('study-compact-details');
    expect(study).toContain('Historia planów');
  });

  it('keeps Work transaction-like: own schedule first, with nearest team visible and roster detail on demand', () => {
    expect(work).toContain('work-summary-line');
    expect(work).toContain('work-next-strip');
    expect(work).toContain('work-shift-row-minimal');
    expect(work).toContain('work-shift-team-details');
    expect(work).toContain('hasSentAvailability ? <AvailabilityWorkComparisonPanel');
  });

  it('keeps Settings essentials visible and infrequent tools collapsed', () => {
    expect(settings).toContain('settings-core');
    expect(settings.match(/settings-collapsible-section/g)?.length).toBeGreaterThanOrEqual(2);
    expect(settings).toContain('Backup i przenoszenie');
    expect(settings).toContain('Historia i bezpieczeństwo');
  });

  it('keeps the same information hierarchy on phones', () => {
    expect(responsive).toContain('.study-view .view-subtitle,');
    expect(responsive).toContain('.study-view .study-upload-dashboard > .study-upload-copy > p { display: none; }');
    expect(responsive).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(responsive).toContain('.settings-collapsible-section > summary { min-height: 50px;');
  });

  it('does not require a database migration', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
