import { describe, expect, it } from 'vitest';
import { DEFAULT_DECORATIVE_BACKGROUND_MODE, normalizeDecorativeBackgroundMode } from '../settings/appearance';

describe('decorative background setting', () => {
  it('accepts every supported mode', () => {
    expect(normalizeDecorativeBackgroundMode('off')).toBe('off');
    expect(normalizeDecorativeBackgroundMode('static')).toBe('static');
    expect(normalizeDecorativeBackgroundMode('animated')).toBe('animated');
  });

  it('falls back safely for old or invalid settings', () => {
    expect(normalizeDecorativeBackgroundMode(undefined)).toBe(DEFAULT_DECORATIVE_BACKGROUND_MODE);
    expect(normalizeDecorativeBackgroundMode('unknown')).toBe(DEFAULT_DECORATIVE_BACKGROUND_MODE);
  });

  it('keeps the conservative static default in 0.5.4', () => {
    expect(DEFAULT_DECORATIVE_BACKGROUND_MODE).toBe('static');
  });
});
