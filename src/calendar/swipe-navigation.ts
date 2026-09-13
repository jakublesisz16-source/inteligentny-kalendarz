export interface SwipePoint {
  x: number;
  y: number;
  time: number;
}

export type PeriodSwipeDelta = -1 | 0 | 1;

export function detectPeriodSwipe(
  start: SwipePoint,
  end: SwipePoint,
  options: { minHorizontalPx?: number; axisRatio?: number; maxDurationMs?: number } = {},
): PeriodSwipeDelta {
  const minHorizontalPx = options.minHorizontalPx ?? 56;
  const axisRatio = options.axisRatio ?? 1.25;
  const maxDurationMs = options.maxDurationMs ?? 850;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const duration = Math.max(0, end.time - start.time);

  if (duration > maxDurationMs) return 0;
  if (Math.abs(dx) < minHorizontalPx) return 0;
  if (Math.abs(dx) < Math.abs(dy) * axisRatio) return 0;

  return dx < 0 ? 1 : -1;
}
