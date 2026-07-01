import assert from 'node:assert/strict';
import test from 'node:test';

import { Route } from '../../domain/entities/route.entity';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import {
  buildBreakPayload,
  isDriverBreakActive,
  validateBreakDurationMinutes,
  MIN_BREAK_MINUTES,
  MAX_BREAK_MINUTES,
} from './driverBreak.utils';

function makeRoute(overrides: Record<string, unknown> = {}) {
  return new Route({
    scheduleId: 'sched-1',
    scheduleDate: new Date('2026-06-23'),
    teamId: 'team-1',
    driverId: 'driver-1',
    arrivalTime: '08:00',
    departureTime: '12:00',
    arrivalMinutes: 480,
    departureMinutes: 720,
    status: RouteStatus.IN_PROGRESS,
    assignedBy: 'ops-1',
    ...overrides,
  });
}

test('validateBreakDurationMinutes accepts 1, 30, and 180 minutes', () => {
  assert.equal(validateBreakDurationMinutes(1), 1);
  assert.equal(validateBreakDurationMinutes(30), 30);
  assert.equal(validateBreakDurationMinutes(180), 180);
});

test('validateBreakDurationMinutes rejects out-of-range and non-integers', () => {
  assert.throws(() => validateBreakDurationMinutes(0));
  assert.throws(() => validateBreakDurationMinutes(181));
  assert.throws(() => validateBreakDurationMinutes(1.5));
  assert.throws(() => validateBreakDurationMinutes('abc'));
});

test('validateBreakDurationMinutes exports expected bounds', () => {
  assert.equal(MIN_BREAK_MINUTES, 1);
  assert.equal(MAX_BREAK_MINUTES, 180);
});

test('isDriverBreakActive returns true while break has not ended', () => {
  const now = Date.now();
  const route = makeRoute({
    driverBreakStartedAt: new Date(now - 60_000),
    driverBreakEndsAt: new Date(now + 30 * 60_000),
    driverBreakDurationMin: 30,
  });
  assert.equal(isDriverBreakActive(route, now), true);
});

test('isDriverBreakActive returns false when break expired or missing', () => {
  const now = Date.now();
  const expired = makeRoute({
    driverBreakStartedAt: new Date(now - 60 * 60_000),
    driverBreakEndsAt: new Date(now - 1000),
    driverBreakDurationMin: 30,
  });
  assert.equal(isDriverBreakActive(expired, now), false);
  assert.equal(isDriverBreakActive(makeRoute(), now), false);
});

test('buildBreakPayload returns active payload with remaining minutes', () => {
  const now = Date.now();
  const startedAt = new Date(now - 5 * 60_000);
  const endsAt = new Date(now + 25 * 60_000);
  const route = makeRoute({
    driverBreakStartedAt: startedAt,
    driverBreakEndsAt: endsAt,
    driverBreakDurationMin: 30,
  });

  const payload = buildBreakPayload(route, now);
  assert.deepEqual(payload, {
    active: true,
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    durationMinutes: 30,
    remainingMinutes: 25,
  });
});

test('buildBreakPayload returns null when break is not active', () => {
  assert.equal(buildBreakPayload(makeRoute(), Date.now()), null);
});
