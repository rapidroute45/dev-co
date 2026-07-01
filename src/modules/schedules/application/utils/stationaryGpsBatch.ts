import { haversineMeters } from './haversine';
import type { GpsTrailPoint } from './matchGpsTrailToRoads';

export const STATIONARY_BATCH_MAX_SPREAD_M = 25;
export const STATIONARY_BATCH_MAX_UNIQUE_POINTS = 8;
export const STATIONARY_TRAIL_SKIP_M = 15;

export type StationaryBatchOptions = {
  maxSpreadM?: number;
  maxUniquePoints?: number;
};

function readCoords(points: GpsTrailPoint[]) {
  return points
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point) => ({ lat: point.lat, lng: point.lng }));
}

function centroid(points: Array<{ lat: number; lng: number }>) {
  const sum = points.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

function maxSpreadFromCentroid(points: Array<{ lat: number; lng: number }>, center: { lat: number; lng: number }) {
  let maxSpreadM = 0;
  for (const point of points) {
    maxSpreadM = Math.max(maxSpreadM, haversineMeters(center.lat, center.lng, point.lat, point.lng));
  }
  return maxSpreadM;
}

function uniqueCoordCount(points: Array<{ lat: number; lng: number }>) {
  const seen = new Set(points.map((point) => `${point.lat},${point.lng}`));
  return seen.size;
}

/** True when a batch is parked GPS jitter, not real movement. */
export function isStationaryGpsBatch(
  points: GpsTrailPoint[],
  options: StationaryBatchOptions = {}
): boolean {
  const maxSpreadM = options.maxSpreadM ?? STATIONARY_BATCH_MAX_SPREAD_M;
  const maxUniquePoints = options.maxUniquePoints ?? STATIONARY_BATCH_MAX_UNIQUE_POINTS;

  const coords = readCoords(points);
  if (coords.length < 3) return false;

  const uniqueCount = uniqueCoordCount(coords);
  if (uniqueCount > maxUniquePoints) return false;

  const center = centroid(coords);
  return maxSpreadFromCentroid(coords, center) <= maxSpreadM;
}

/** Collapse a stationary batch to one centroid point at the last sample time. */
export function collapseStationaryBatch(points: GpsTrailPoint[]): GpsTrailPoint {
  const valid = points.filter(
    (point) =>
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      !Number.isNaN(point.recordedAt.getTime())
  );
  if (valid.length === 0) {
    throw new Error('Cannot collapse empty stationary batch.');
  }

  const coords = valid.map((point) => ({ lat: point.lat, lng: point.lng }));
  const center = centroid(coords);
  const last = valid[valid.length - 1]!;

  return {
    lat: center.lat,
    lng: center.lng,
    recordedAt: last.recordedAt,
  };
}

/** Skip appending when the new point is too close to the last stored trail point. */
export function shouldSkipTrailAppend(
  existingPath: GpsTrailPoint[] | undefined,
  point: GpsTrailPoint | null | undefined,
  minSeparationM = STATIONARY_TRAIL_SKIP_M
): boolean {
  if (!point || !existingPath?.length) return false;

  const last = existingPath[existingPath.length - 1]!;
  if (!Number.isFinite(last.lat) || !Number.isFinite(last.lng)) return false;

  return haversineMeters(last.lat, last.lng, point.lat, point.lng) <= minSeparationM;
}
