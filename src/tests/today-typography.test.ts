import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const today = read('src/calendar/TodayView.tsx');
const index = read('src/styles/index.css');
const owner = read('src/styles/today-polish.css');

describe('Today UI polish - typography and semantic alignment', () => {
  it('uses the common Today view with a scoped visual owner loaded last', () => {
    expect(today).toContain('today-view today-ui-v350');
    expect(index.trimEnd().endsWith("@import './today-polish.css';")).toBe(true);
    expect(owner).toContain('.today-ui-v350 .today-header h1');
  });

  it('preserves the empty-day and tomorrow semantics with readable source-derived details', () => {
    expect(today).toContain('<EmptyState icon="calendar" title="Wolny dzień" description="Brak zaplanowanych wydarzeń na dziś" />');
    expect(today).toContain('today-tomorrow-title">Jutro');
    expect(read('src/ui/Navigation.tsx')).toContain('<AppIcon name={item.icon}');
    expect(read('src/ui/EmptyState.tsx')).toContain('<AppIcon name={icon} size={28} />');
    expect(read('src/ui/AppIcon.tsx')).toContain("if (name === 'calendar') return <AppBrandMark");
    expect(today).toContain('className="today-tomorrow-time"');
    expect(today).toContain('{event.title}');
    expect(today).toContain('{location}');
    expect(owner).toContain('grid-template-columns: minmax(0, 1fr) !important;');
    expect(owner).toContain('overflow-wrap: anywhere;');
    expect(owner).toContain('grid-template-columns: minmax(0, 1fr);');
  });

  it('does not hide tomorrow data, shrink touch actions or change the Study schedule', () => {
    expect(today).toContain('tomorrowEvents.map((event)');
    expect(today).toContain('nextEvent && !tomorrowEvents.length');
    expect(today).toContain('button button-secondary button-small today-header-add');
    expect(owner).toContain('@media (max-width: 620px)');
    expect(read('src/core/version.ts')).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
