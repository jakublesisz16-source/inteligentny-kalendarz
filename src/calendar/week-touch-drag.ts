export interface TouchDragPoint {
  x: number;
  y: number;
}

export function shouldCancelWeekLongPress(start: TouchDragPoint, current: TouchDragPoint, tolerance = 12): boolean {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return Math.hypot(dx, dy) > tolerance;
}

export function computeMobileWeekTargetDayIndex(input: {
  startIndex: number;
  startX: number;
  currentX: number;
  viewportWidth: number;
  dayCount?: number;
}): number {
  const dayCount = Math.max(1, input.dayCount ?? 7);
  const safeWidth = Math.max(1, input.viewportWidth);
  const dayWidth = Math.max(44, safeWidth / dayCount);
  const shift = Math.round((input.currentX - input.startX) / dayWidth);
  return Math.max(0, Math.min(dayCount - 1, input.startIndex + shift));
}
