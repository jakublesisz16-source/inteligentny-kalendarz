import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const today = readFileSync('src/calendar/TodayView.tsx', 'utf8');
const components = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.58 Today single-surface agenda', () => {
  it('marks the populated Today panel as one visual surface', () => {
    expect(today).toContain("hasPlan ? ' today-plan-panel today-single-surface' : ' today-empty-panel'");
    expect(today).toContain('showAllWorkCoworkers');
  });

  it('removes card chrome from event rows and separates multiple rows subtly', () => {
    expect(components).toContain('/* 1.2.0.58 - Today uses one visual surface instead of cards inside a card */');
    expect(components).toContain('.today-plan-panel.today-single-surface .event-card');
    expect(components).toContain('border: 0;');
    expect(components).toContain('.event-card + .event-card');
  });

  it('keeps the same single-surface hierarchy on mobile', () => {
    expect(responsive).toContain('/* 1.2.0.58 - keep the single-surface Today hierarchy on phones too */');
    expect(responsive).toContain('.today-plan-panel.today-single-surface .event-card');
  });

  it('keeps database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
