import { describe, expect, it } from 'vitest';
import { DEFAULT_DECORATIVE_BACKGROUND_MODE, normalizeDecorativeBackgroundMode } from '../settings/appearance';

describe('legacy decorative background setting compatibility', () => {
  it('still normalizes old persisted values without requiring a database migration', () => {
    expect(normalizeDecorativeBackgroundMode('off')).toBe('off');
    expect(normalizeDecorativeBackgroundMode('static')).toBe('static');
    expect(normalizeDecorativeBackgroundMode('animated')).toBe('animated');
    expect(normalizeDecorativeBackgroundMode(undefined)).toBe(DEFAULT_DECORATIVE_BACKGROUND_MODE);
  });
});
