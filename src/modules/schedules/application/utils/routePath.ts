import { haversineMeters } from './haversine';
import { filterGpsPathOutliers } from './stopDestinationCoords';

export const MAX_STORED_ROUTE_PATH_POINTS = 5000;
export const MAX_TRAIL_EMIT_POINTS = 60;

/** Skip incoming points that rest on the last stored position. */
export const MERGE_TRAIL_DEDUP_M = 8;

/** Reject implausible jumps between consecutive stored trail points (~150 km/h). */
export const TRAIL_MAX_SEGMENT_SPEED_MPS = 42;

type RoutePathPoint = { lat: number; lng: number; recordedAt: Date };

function pathPointKey(recordedAt: Date): string {
  return recordedAt.toISOString();
}

function dedupeIncomingAgainstTail(existing: RoutePathPoint[], incoming: RoutePathPoint[]) {
  if (existing.length === 0 || incoming.length === 0) return incoming;

  const tail = existing[existing.length - 1]!;
  let startIndex = 0;
  while (startIndex < incoming.length) {
    const next = incoming[startIndex]!;
    if (
      haversineMeters(tail.lat, tail.lng, next.lat, next.lng) > MERGE_TRAIL_DEDUP_M ||
      next.recordedAt.getTime() > tail.recordedAt.getTime()
    ) {
      break;
    }
    startIndex += 1;
  }

  return incoming.slice(startIndex);
}

/** Drop segments that imply impossible driving speed (bad snap / batch seams). */
export function filterTrailSpeedOutliers(
  points: RoutePathPoint[],
  maxSpeedMps = TRAIL_MAX_SEGMENT_SPEED_MPS
): RoutePathPoint[] {
  if (points.length <= 1) return points;

  const kept: RoutePathPoint[] = [points[0]!];
  for (let i = 1; i < points.length; i += 1) {
    const prev = kept[kept.length - 1]!;
    const next = points[i]!;
    const dtSec = Math.max(0.001, (next.recordedAt.getTime() - prev.recordedAt.getTime()) / 1000);
    const distanceM = haversineMeters(prev.lat, prev.lng, next.lat, next.lng);
    if (distanceM / dtSec <= maxSpeedMps) {
      kept.push(next);
    }
  }

  return kept;
}

/** Merge incoming batch points with existing path, dedupe by timestamp, cap size. */
export function mergeRoutePathPoints(
  existing: RoutePathPoint[],
  incoming: RoutePathPoint[],
  maxPoints = MAX_STORED_ROUTE_PATH_POINTS
): RoutePathPoint[] {
  const trimmedIncoming = dedupeIncomingAgainstTail(existing, incoming);
  const byKey = new Map<string, RoutePathPoint>();

  for (const point of [...existing, ...trimmedIncoming]) {
    const recordedAt =
      point.recordedAt instanceof Date && !Number.isNaN(point.recordedAt.getTime())
        ? point.recordedAt
        : new Date();
    byKey.set(pathPointKey(recordedAt), {
      lat: point.lat,
      lng: point.lng,
      recordedAt,
    });
  }

  const sorted = [...byKey.values()].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );

  return filterGpsPathOutliers(filterTrailSpeedOutliers(sorted)).slice(-maxPoints);
}
