import { asLocationDate } from './locationDates';
import type { Route } from '../../domain/entities/route.entity';

export const MIN_BREAK_MINUTES = 1;
export const MAX_BREAK_MINUTES = 180;

export type DriverBreakEndReason = 'manual' | 'timer' | 'movement';

export function isDriverBreakActive(route: Route, now = Date.now()): boolean {
  const startedAt = asLocationDate(route.driverBreakStartedAt);
  const endsAt = asLocationDate(route.driverBreakEndsAt);
  if (!startedAt || !endsAt) return false;
  return now < endsAt.getTime();
}

export function buildBreakPayload(route: Route, now = Date.now()) {
  const startedAt = asLocationDate(route.driverBreakStartedAt);
  const endsAt = asLocationDate(route.driverBreakEndsAt);
  const durationMinutes = route.driverBreakDurationMin;

  if (
    !startedAt ||
    !endsAt ||
    durationMinutes == null ||
    !isDriverBreakActive(route, now)
  ) {
    return null;
  }

  const remainingMs = Math.max(0, endsAt.getTime() - now);
  const remainingMinutes = Math.ceil(remainingMs / 60_000);

  return {
    active: true,
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    durationMinutes,
    remainingMinutes,
  };
}

export function clearDriverBreakFields() {
  return {
    driverBreakStartedAt: null,
    driverBreakEndsAt: null,
    driverBreakDurationMin: null,
    driverBreakAnchorLat: null,
    driverBreakAnchorLng: null,
    driverBreakMovementAlertSentAt: null,
  };
}

export function validateBreakDurationMinutes(value: unknown): number {
  const minutes = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
    throw new Error('durationMinutes must be a whole number.');
  }
  if (minutes < MIN_BREAK_MINUTES || minutes > MAX_BREAK_MINUTES) {
    throw new Error(
      `durationMinutes must be between ${MIN_BREAK_MINUTES} and ${MAX_BREAK_MINUTES}.`
    );
  }
  return minutes;
}
