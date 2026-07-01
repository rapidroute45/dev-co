import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collapseStationaryBatch,
  isStationaryGpsBatch,
  shouldSkipTrailAppend,
} from './stationaryGpsBatch';

function point(lat: number, lng: number, offsetSec = 0): { lat: number; lng: number; recordedAt: Date } {
  return {
    lat,
    lng,
    recordedAt: new Date(Date.parse('2026-06-01T12:00:00.000Z') + offsetSec * 1000),
  };
}

test('isStationaryGpsBatch detects parked jitter with few unique points', () => {
  const jitter = [
    point(36.1147, -115.1728, 0),
    point(36.1147, -115.1728, 1),
    point(36.11471, -115.17279, 2),
    point(36.11469, -115.17281, 3),
    point(36.11472, -115.17278, 4),
  ];
  const batch = Array.from({ length: 30 }, (_, index) => ({
    ...jitter[index % jitter.length]!,
    recordedAt: point(36.1147, -115.1728, index).recordedAt,
  }));

  assert.equal(isStationaryGpsBatch(batch), true);
});

test('isStationaryGpsBatch rejects moving batches with many unique points', () => {
  const batch = Array.from({ length: 30 }, (_, index) =>
    point(36.1147 + index * 0.001, -115.1728 + index * 0.0005, index)
  );

  assert.equal(isStationaryGpsBatch(batch), false);
});

test('collapseStationaryBatch returns centroid with last timestamp', () => {
  const batch = [
    point(36.1, -115.17, 0),
    point(36.1001, -115.1701, 1),
    point(36.0999, -115.1699, 29),
  ];

  const collapsed = collapseStationaryBatch(batch);
  assert.ok(Math.abs(collapsed.lat - 36.1) < 0.001);
  assert.ok(Math.abs(collapsed.lng - -115.17) < 0.001);
  assert.equal(collapsed.recordedAt.toISOString(), batch[2]!.recordedAt.toISOString());
});

test('shouldSkipTrailAppend is true when near last stored point', () => {
  const existing = [point(36.1, -115.17, 0)];
  const next = point(36.10005, -115.17005, 30);

  assert.equal(shouldSkipTrailAppend(existing, next), true);
});

test('shouldSkipTrailAppend is false when far from last stored point', () => {
  const existing = [point(36.1, -115.17, 0)];
  const next = point(36.11, -115.18, 30);

  assert.equal(shouldSkipTrailAppend(existing, next), false);
});
