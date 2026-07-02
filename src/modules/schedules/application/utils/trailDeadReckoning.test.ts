import assert from 'node:assert/strict';
import test from 'node:test';

import { isStationarySpeed, computeMedianSpeedMps } from './batchLocationMetrics';
import {
  filterRegressiveIncomingPoints,
  mergeRoutePathPoints,
} from './routePath';
import {
  interpolateTrailBetweenAnchors,
  shouldRejectSnapRatio,
} from './trailDeadReckoning';

test('computeMedianSpeedMps returns low speed for parked samples', () => {
  const base = new Date('2026-06-23T10:00:00.000Z');
  const points = Array.from({ length: 5 }, (_, index) => ({
    lat: 31.52 + index * 0.000001,
    lng: 74.35 + index * 0.000001,
    rawLat: 31.52 + index * 0.000001,
    rawLng: 74.35 + index * 0.000001,
    recordedAt: new Date(base.getTime() + index * 1000),
  }));

  assert.ok(computeMedianSpeedMps(points) < 1);
  assert.ok(isStationarySpeed(points));
});

test('filterRegressiveIncomingPoints drops older timestamps on the tail', () => {
  const t0 = new Date('2026-06-23T10:00:00.000Z');
  const t1 = new Date('2026-06-23T10:00:30.000Z');
  const existing = [{ lat: 31.52, lng: 74.35, recordedAt: t1 }];
  const incoming = [{ lat: 31.52001, lng: 74.35001, recordedAt: t0 }];

  const filtered = filterRegressiveIncomingPoints(existing, incoming);
  assert.equal(filtered.length, 0);
});

test('mergeRoutePathPoints keeps composite keys for same timestamp different coords', () => {
  const t0 = new Date('2026-06-23T10:00:00.000Z');
  const t1 = new Date('2026-06-23T10:00:05.000Z');
  const merged = mergeRoutePathPoints(
    [{ lat: 31.52, lng: 74.35, recordedAt: t0 }],
    [
      { lat: 31.5202, lng: 74.3502, recordedAt: t0 },
      { lat: 31.5208, lng: 74.3508, recordedAt: t1 },
    ]
  );

  assert.equal(merged.length, 3);
});

test('shouldRejectSnapRatio flags collapsed Google output', () => {
  assert.equal(shouldRejectSnapRatio(30, 2), true);
  assert.equal(shouldRejectSnapRatio(5, 2), false);
});

test('interpolateTrailBetweenAnchors densifies between anchors', () => {
  const start = { lat: 31.52, lng: 74.35, recordedAt: new Date('2026-06-23T10:00:00.000Z') };
  const end = { lat: 31.525, lng: 74.355, recordedAt: new Date('2026-06-23T10:00:30.000Z') };
  const raw = [start, end];

  const interpolated = interpolateTrailBetweenAnchors(start, end, raw);
  assert.ok(interpolated.length >= 3);
  assert.equal(interpolated[0]!.recordedAt.toISOString(), start.recordedAt.toISOString());
  assert.equal(
    interpolated[interpolated.length - 1]!.recordedAt.toISOString(),
    end.recordedAt.toISOString()
  );
});
