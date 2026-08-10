export type DecorativeBackgroundMode = 'off' | 'static' | 'animated';

export const DEFAULT_DECORATIVE_BACKGROUND_MODE: DecorativeBackgroundMode = 'static';

export function normalizeDecorativeBackgroundMode(value: unknown): DecorativeBackgroundMode {
  return value === 'off' || value === 'static' || value === 'animated'
    ? value
    : DEFAULT_DECORATIVE_BACKGROUND_MODE;
}
