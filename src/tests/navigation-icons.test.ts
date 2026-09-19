import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AppView } from '../app/app.types';
import { APP_ICON_NAMES, AppIcon } from '../ui/AppIcon';
import { NAVIGATION_ITEMS } from '../ui/Navigation';

const EXPECTED_VIEWS: AppView[] = [
  'today',
  'calendar',
  'finance',
  'study',
  'work',
  'settings',
];

describe('1.2.0.2 navigation foundation', () => {
  it('keeps exactly the six product-level sections in the agreed order', () => {
    expect(NAVIGATION_ITEMS.map((item) => item.id)).toEqual(EXPECTED_VIEWS);
  });

  it('maps every visible navigation item to a supported non-empty icon', () => {
    expect(NAVIGATION_ITEMS).toHaveLength(6);
    for (const item of NAVIGATION_ITEMS) {
      expect(item.icon).toBeTruthy();
      expect(APP_ICON_NAMES).toContain(item.icon);
      expect(item.label.trim()).not.toBe('');
      expect(item.short.trim()).not.toBe('');
    }
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.icon)).size).toBe(6);
  });

  it('keeps legacy module icons available for a future reactivation without exposing them in navigation', () => {
    expect(APP_ICON_NAMES).toEqual(expect.arrayContaining(['shopping', 'cycle', 'locations']));
    expect(NAVIGATION_ITEMS.some((item) => ['shopping', 'cycle', 'locations'].includes(item.id))).toBe(false);
  });

  it('does not keep the removed global-search icon', () => {
    expect(APP_ICON_NAMES).not.toContain('search' as never);
    expect(NAVIGATION_ITEMS).toHaveLength(6);
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
