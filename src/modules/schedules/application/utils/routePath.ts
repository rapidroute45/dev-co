import { filterGpsPathOutliers } from './stopDestinationCoords';

export const MAX_STORED_ROUTE_PATH_POINTS = 5000;
export const MAX_TRAIL_EMIT_POINTS = 60;

type RoutePathPoint = { lat: number; lng: number; recordedAt: Date };

function pathPointKey(recordedAt: Date): string {
  return recordedAt.toISOString();
}

/** Merge incoming batch points with existing path, dedupe by timestamp, cap size. */
export function mergeRoutePathPoints(
  existing: RoutePathPoint[],
  incoming: RoutePathPoint[],
  maxPoints = MAX_STORED_ROUTE_PATH_POINTS
): RoutePathPoint[] {
  const byKey = new Map<string, RoutePathPoint>();

  for (const point of [...existing, ...incoming]) {
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

  return filterGpsPathOutliers(
    [...byKey.values()]
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
      .slice(-maxPoints)
  );
}
