import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterRegressiveIncomingPoints,
  filterTrailSpeedOutliers,
  mergeRoutePathPoints,
} from './routePath';

test('mergeRoutePathPoints skips incoming points stacked on the existing tail', () => {
  const t0 = new Date('2026-06-23T10:00:00.000Z');
  const t1 = new Date('2026-06-23T10:00:30.000Z');
  const existing = [{ lat: 31.52, lng: 74.35, recordedAt: t0 }];
  const incoming = [
    { lat: 31.52001, lng: 74.35001, recordedAt: t0 },
    { lat: 31.521, lng: 74.351, recordedAt: t1 },
  ];

  const merged = mergeRoutePathPoints(existing, incoming);
  assert.equal(merged.length, 2);
  assert.equal(merged[1]!.lat, 31.521);
});

test('filterRegressiveIncomingPoints drops regressive timestamps', () => {
  const t0 = new Date('2026-06-23T10:00:00.000Z');
  const t1 = new Date('2026-06-23T10:00:30.000Z');
  const existing = [{ lat: 31.52, lng: 74.35, recordedAt: t1 }];
  const incoming = [{ lat: 31.52001, lng: 74.35001, recordedAt: t0 }];

  assert.equal(filterRegressiveIncomingPoints(existing, incoming).length, 0);
});

test('filterTrailSpeedOutliers drops impossible driving segments', () => {
  const points = [
    { lat: 31.52, lng: 74.35, recordedAt: new Date('2026-06-23T10:00:00.000Z') },
    { lat: 31.53, lng: 74.36, recordedAt: new Date('2026-06-23T10:00:01.000Z') },
  ];

  const filtered = filterTrailSpeedOutliers(points);
  assert.equal(filtered.length, 1);
});
