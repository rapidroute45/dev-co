import type { Route } from '../../domain/entities/route.entity';

type StopLike = { completedAt?: Date | null };

/** Hours from driver start through route completion, or span of stop completions as fallback. */
export function routeDurationHours(
  route: Pick<Route, 'startedAt' | 'completedAt'> | { startedAt?: Date | null; completedAt?: Date | null },
  dropoffs: StopLike[] = []
): number | null {
  const startedAt = route.startedAt ?? null;
  const completedAt = route.completedAt ?? null;

  if (startedAt && completedAt) {
    const ms = completedAt.getTime() - startedAt.getTime();
    if (ms > 0) return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
  }

  const stopTimes = dropoffs
    .map((stop) => stop.completedAt)
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
    .map((value) => value.getTime());

  if (stopTimes.length >= 1) {
    const ms = Math.max(...stopTimes) - Math.min(...stopTimes);
    if (ms >= 0) return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
  }

  return null;
}

export function resolveRouteTimingFromStops(
  route: Pick<Route, 'startedAt' | 'completedAt'>,
  dropoffs: StopLike[]
): { startedAt: Date | null; completedAt: Date } {
  const stopTimes = dropoffs
    .map((stop) => stop.completedAt)
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));

  const completedAt =
    stopTimes.length > 0
      ? new Date(Math.max(...stopTimes.map((value) => value.getTime())))
      : new Date();

  let startedAt = route.startedAt ?? null;
  if (!startedAt && stopTimes.length > 0) {
    startedAt = new Date(Math.min(...stopTimes.map((value) => value.getTime())));
  }

  return { startedAt, completedAt };
}
