import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const consistency = readFileSync('src/styles/interface-consistency.css', 'utf8');
const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const study = readFileSync('src/study/StudyView.tsx', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.85 interface consistency and semantic category contrast', () => {
  it('uses the restored semantic colors for Study, Work and Personal with stronger contrast', () => {
    expect(tokens).toContain('--category-study: #b95d84');
    expect(tokens).toContain('--category-work: #2f7382');
    expect(tokens).toContain('--category-personal: #695591');
    expect(consistency).toContain('.calendar-week-event.category-study');
    expect(consistency).toContain('.calendar-week-event.category-work');
    expect(consistency).toContain('.calendar-week-event.category-personal');
  });

  it('carries semantic categories into calendar filters and mobile day preview', () => {
    expect(calendar).toContain('filter-${item.id.toLowerCase()}');
    expect(calendar).toContain('category-${event.category.toLowerCase()}');
    expect(consistency).toContain('.calendar-filter-chip.filter-study.active');
    expect(consistency).toContain('.calendar-mobile-day-preview-event.category-work');
  });

  it('uses one page-title scale across the main modules', () => {
    expect(consistency).toContain('.study-view > .view-header h1');
    expect(consistency).toContain('.work-view > .view-header h1');
    expect(consistency).toContain('.settings-minimal-view > .view-header h1');
    expect(consistency).toContain('.today-header h1');
    expect(consistency).toContain('.calendar-view-header h1');
    expect(consistency).toContain('.finance-view-header h1');
  });

  it('makes Study calmer without hiding its workflow', () => {
    expect(study).toContain('Wczytaj Excel. Przed zapisem zobaczysz zmiany i wybierzesz tylko potrzebne grupy.');
    expect(consistency).toContain('.study-view .study-upload-simple');
    expect(consistency).toContain('min-height: 220px');
  });

  it('keeps the database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
