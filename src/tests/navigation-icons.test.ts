import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AppView } from '../app/app.types';
import { APP_ICON_NAMES, AppIcon } from '../ui/AppIcon';
import { NAVIGATION_ITEMS } from '../ui/Navigation';

const EXPECTED_VIEWS: AppView[] = [
  'today',
  'calendar',
  'work',
  'shopping',
  'cycle',
  'study',
  'locations',
  'settings',
];

describe('0.5.3 navigation icons', () => {
  it('keeps exactly the eight existing navigation views in the same order', () => {
    expect(NAVIGATION_ITEMS.map((item) => item.id)).toEqual(EXPECTED_VIEWS);
  });

  it('maps every navigation item to a supported non-empty icon', () => {
    expect(NAVIGATION_ITEMS).toHaveLength(8);
    for (const item of NAVIGATION_ITEMS) {
      expect(item.icon).toBeTruthy();
      expect(APP_ICON_NAMES).toContain(item.icon);
      expect(item.label.trim()).not.toBe('');
      expect(item.short.trim()).not.toBe('');
    }
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.icon)).size).toBe(8);
  });

  it('keeps search as a utility icon rather than a ninth navigation item', () => {
    expect(APP_ICON_NAMES).toContain('search');
    expect(NAVIGATION_ITEMS.some((item) => item.icon === 'search')).toBe(false);
    expect(NAVIGATION_ITEMS).toHaveLength(8);
  });

  it('renders every icon as decorative currentColor SVG', () => {
    for (const name of APP_ICON_NAMES) {
      const markup = renderToStaticMarkup(createElement(AppIcon, { name }));
      expect(markup.startsWith('<svg')).toBe(true);
      expect(markup).toContain('stroke="currentColor"');
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('focusable="false"');
    }
  });
});
