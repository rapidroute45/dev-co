import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOsrmMatchChunks, matchGpsTrailToRoads } from './matchGpsTrailToRoads';
import { snapGpsTrailToPolyline } from './snapGpsTrailToPolyline';

test('buildOsrmMatchChunks splits long batches with one-point overlap', () => {
  const points = Array.from({ length: 30 }, (_, index) => ({
    lat: 31.52 + index * 0.0001,
    lng: 74.35 + index * 0.0001,
  }));

  const chunks = buildOsrmMatchChunks(points, 12);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0]!.length, 12);
  assert.equal(chunks[1]!.length, 12);
  assert.deepEqual(chunks[0]!.slice(-1), chunks[1]!.slice(0, 1));
});

test('buildOsrmMatchChunks returns empty for single point', () => {
  assert.deepEqual(buildOsrmMatchChunks([{ lat: 1, lng: 2 }]), []);
});

test('snapGpsTrailToPolyline snaps GPS samples onto planned polyline', () => {
  const polyline = [
    { lat: 31.52, lng: 74.35 },
    { lat: 31.521, lng: 74.351 },
    { lat: 31.522, lng: 74.352 },
  ];
  const points = [
    { lat: 31.5202, lng: 74.3502, recordedAt: new Date('2026-06-23T10:00:00.000Z') },
    { lat: 31.5212, lng: 74.3512, recordedAt: new Date('2026-06-23T10:00:30.000Z') },
  ];

  const snapped = snapGpsTrailToPolyline(points, polyline, 0);
  assert.equal(snapped.length, 2);
  assert.notDeepEqual(
    { lat: snapped[0]!.lat, lng: snapped[0]!.lng },
    { lat: points[0]!.lat, lng: points[0]!.lng }
  );
  assert.equal(snapped[0]!.recordedAt.toISOString(), points[0]!.recordedAt.toISOString());
  assert.ok(snapped[1]!.lat >= snapped[0]!.lat - 0.00001);
});

test('snapGpsTrailToPolyline leaves far off-route GPS unsnapped', () => {
  const polyline = [
    { lat: 31.52, lng: 74.35 },
    { lat: 31.521, lng: 74.351 },
  ];
  const points = [
    { lat: 31.6, lng: 74.45, recordedAt: new Date('2026-06-23T10:00:00.000Z') },
  ];

  const snapped = snapGpsTrailToPolyline(points, polyline, 0);
  assert.equal(snapped[0]!.lat, points[0]!.lat);
  assert.equal(snapped[0]!.lng, points[0]!.lng);
});

test('matchGpsTrailToRoads snaps single-point batches to planned polyline', async () => {
  const polyline = [
    { lat: 31.52, lng: 74.35 },
    { lat: 31.521, lng: 74.351 },
    { lat: 31.522, lng: 74.352 },
  ];
  const points = [
    { lat: 31.5202, lng: 74.3502, recordedAt: new Date('2026-06-23T10:00:00.000Z') },
  ];

  const matched = await matchGpsTrailToRoads(points, {
    plannedPolyline: polyline,
    startProgressIndex: 0,
  });

  assert.equal(matched.provider, 'planned');
  assert.equal(matched.points.length, 1);
  assert.notDeepEqual(
    { lat: matched.points[0]!.lat, lng: matched.points[0]!.lng },
    { lat: points[0]!.lat, lng: points[0]!.lng }
  );
});
