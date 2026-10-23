import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TodayView } from '../calendar/TodayView';

const source = (path: string) => readFileSync(path, 'utf8');

describe('Build350 - Today matches mobile and excludes availability', () => {
  it('shows only calendar events and free-day message, not work availability', () => {
    const today = source('src/calendar/TodayView.tsx');
    const app = source('src/app/App.tsx');
    expect(today).not.toContain('todayAvailability');
    expect(today).not.toContain('availabilityPlans');
    expect(today).not.toContain('availability-overlay-card');
    expect(today).not.toContain('dyspozycyjność');
    expect(app).not.toMatch(/<TodayView[^>]*availabilityPlans=/u);
    expect(source('src/work/WorkView.tsx')).toContain('availabilityPlans={availabilityPlans}');
    const html = renderToStaticMarkup(createElement(TodayView, {
      events: [], locations: [], timeFormat: '24h', onAdd: () => {}, onEdit: () => {},
      showPolishHolidays: false, showWumAcademicCalendar: false,
    }));
    expect(html).toContain('Wolny dzień');
    expect(html).toContain('Brak zaplanowanych wydarzeń na dziś');
    expect(html).not.toContain('Proponowana dyspozycyjność');
  });

  it('stacks two independent cards on desktop as on mobile', () => {
    const css = source('src/styles/today-polish.css');
    expect(css).toContain('.today-ui-v350.is-empty .today-plan-panel.today-single-surface {');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(css).toContain('> .empty-state p {');
    expect(css).toContain('display: block;');
    expect(css).toContain('grid-row: 3;');
    expect(source('src/ui/EmptyState.tsx')).toContain('<AppIcon name={icon} size={28} />');
    expect(source('src/ui/Navigation.tsx')).toContain('<AppIcon name={item.icon}');
  });
});
