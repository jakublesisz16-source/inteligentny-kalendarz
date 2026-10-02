import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const consistency = readFileSync(new URL('../planning/ConsistencyCenter.tsx', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build274 calendar utility polish', () => {
  it('shows the full calendar naturally without category-filter chrome', () => {
    expect(calendar).not.toContain('CalendarFilter');
    expect(calendar).not.toContain('calendar-filter-select');
    expect(calendar).toContain('calendar-view-switch-inline');
    expect(calendar).toContain('calendar-toolbar-actions');
  });

  it('keeps month/week beside Today and multi-day controls', () => {
    const toolbarStart = calendar.indexOf('calendar-toolbar calendar-toolbar-modern');
    const toolbarEnd = calendar.indexOf('multi-day-selection-bar', toolbarStart);
    const toolbar = calendar.slice(toolbarStart, toolbarEnd);
    expect(toolbar).toContain('>Miesiąc</button>');
    expect(toolbar).toContain('>Tydzień</button>');
    expect(toolbar).toContain('>Dzisiaj</button>');
    expect(toolbar).toContain("'Wiele dni'");
  });

  it('shows a resolved event address in consistency rows instead of a technical category name', () => {
    expect(consistency).toContain('locations: Location[]');
    expect(consistency).toContain('location?.address?.trim()');
    expect(consistency).toContain('consistency-event-address');
    expect(consistency).not.toContain('· {event.category}');
  });

  it('keeps desktop Today intentionally narrower than the other utility views', () => {
    expect(refinement).toContain('Build274 - calm calendar toolbar');
    expect(refinement).toContain('.today-view { max-width: 900px; }');
  });

  it('advances only the build and keeps schema 14', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.275'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
