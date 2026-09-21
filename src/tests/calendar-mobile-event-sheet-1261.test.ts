import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const app = readFileSync('src/app/App.tsx', 'utf8');
const form = readFileSync('src/events/EventForm.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.61 shared mobile event composer', () => {
  it('routes a mobile week hour into the normal editor while month taps stay selection-only', () => {
    expect(calendar).toContain("window.matchMedia('(max-width: 820px)').matches");
    expect(calendar).toContain('onAdd(initial, undefined, new Date(initial.getTime() + 60 * 60 * 1000))');
    const monthQuickAdd = calendar.slice(calendar.indexOf('function openMonthQuickAdd'), calendar.indexOf('function quickAddInitialDate'));
    expect(monthQuickAdd).toContain('setQuickAdd(null)');
    expect(monthQuickAdd).not.toContain('onAdd(');
  });

  it('keeps desktop compact quick add while using the event form as the shared mobile sheet', () => {
    expect(calendar).toContain("setQuickAdd(buildQuickAddState(day, 'WEEK', hour))");
    expect(calendar).toContain("buildQuickAddState(day, 'MONTH')");
    expect(form).toContain('id="event-editor-form"');
    expect(app).toContain('form="event-editor-form"');
    expect(app).toContain('event-mobile-header-save');
  });

  it('keeps the mobile create sheet minimal and schema-stable', () => {
    expect(responsive).toContain('/* 1.2.0.61 - shared mobile event bottom sheet */');
    expect(responsive).toContain('.event-form-create:not(.event-form-multi-create) .modal-actions { display: none; }');
    expect(responsive).toContain('.event-form-create .event-location-input > small { display: none; }');
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
