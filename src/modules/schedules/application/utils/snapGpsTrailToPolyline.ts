import { haversineMeters } from './haversine';
import type { GpsTrailPoint } from './matchGpsTrailToRoads';
import type { LatLng } from './osrmDrivingPath';

const DEFAULT_MAX_SNAP_M = 40;

type ProjectResult = {
  lat: number;
  lng: number;
  nearestIndex: number;
  distanceM: number;
};

function projectOnSegment(point: LatLng, a: LatLng, b: LatLng): Omit<ProjectResult, 'nearestIndex'> & { t: number } {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return {
      lat: a.lat,
      lng: a.lng,
      t: 0,
      distanceM: haversineMeters(point.lat, point.lng, a.lat, a.lng),
    };
  }

  let t = ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const lat = a.lat + t * dy;
  const lng = a.lng + t * dx;
  return {
    lat,
    lng,
    t,
    distanceM: haversineMeters(point.lat, point.lng, lat, lng),
  };
}

function distanceToPolylineWithIndex(gps: LatLng, polyline: LatLng[]): ProjectResult {
  if (polyline.length === 0) {
    return {
      lat: gps.lat,
      lng: gps.lng,
      nearestIndex: 0,
      distanceM: Infinity,
    };
  }

  if (polyline.length === 1) {
    const only = polyline[0]!;
    return {
      lat: only.lat,
      lng: only.lng,
      nearestIndex: 0,
      distanceM: haversineMeters(gps.lat, gps.lng, only.lat, only.lng),
    };
  }

  let bestIndex = 0;
  let bestLat = gps.lat;
  let bestLng = gps.lng;
  let bestDist = Infinity;

  for (let i = 0; i < polyline.length - 1; i += 1) {
    const projected = projectOnSegment(gps, polyline[i]!, polyline[i + 1]!);
    if (projected.distanceM < bestDist) {
      bestDist = projected.distanceM;
      bestLat = projected.lat;
      bestLng = projected.lng;
      bestIndex = projected.t >= 0.5 ? i + 1 : i;
    }
  }

  return {
    lat: bestLat,
    lng: bestLng,
    nearestIndex: bestIndex,
    distanceM: bestDist,
  };
}

function snapPointToPolyline(
  gps: LatLng,
  polyline: LatLng[],
  currentProgressIndex: number,
  maxSnapM: number
) {
  const { lat, lng, nearestIndex, distanceM } = distanceToPolylineWithIndex(gps, polyline);

  if (polyline.length === 0) {
    return {
      lat: gps.lat,
      lng: gps.lng,
      progressIndex: currentProgressIndex,
      snapped: false,
      distanceM,
    };
  }

  if (distanceM <= maxSnapM) {
    return {
      lat,
      lng,
      progressIndex: Math.max(currentProgressIndex, nearestIndex),
      snapped: true,
      distanceM,
    };
  }

  return {
    lat: gps.lat,
    lng: gps.lng,
    progressIndex: currentProgressIndex,
    snapped: false,
    distanceM,
  };
}

/** Snap each GPS sample to a planned route polyline with monotonic progress. */
export function snapGpsTrailToPolyline(
  points: GpsTrailPoint[],
  polyline: LatLng[],
  startProgressIndex = 0,
  maxSnapM = DEFAULT_MAX_SNAP_M
): GpsTrailPoint[] {
  if (polyline.length < 2 || points.length === 0) return points;

  let progressIndex = Math.max(0, startProgressIndex);
  const snapped: GpsTrailPoint[] = [];

  for (const point of points) {
    const result = snapPointToPolyline(
      { lat: point.lat, lng: point.lng },
      polyline,
      progressIndex,
      maxSnapM
    );
    progressIndex = result.progressIndex;
    snapped.push({
      lat: result.snapped ? result.lat : point.lat,
      lng: result.snapped ? result.lng : point.lng,
      recordedAt: point.recordedAt,
    });
  }

  return snapped;
}

export function countSnappedToPolyline(
  input: GpsTrailPoint[],
  output: GpsTrailPoint[],
  polyline: LatLng[],
  maxSnapM = DEFAULT_MAX_SNAP_M
): number {
  let snappedCount = 0;
  for (let i = 0; i < input.length; i += 1) {
    const raw = input[i]!;
    const out = output[i]!;
    if (raw.lat !== out.lat || raw.lng !== out.lng) {
      snappedCount += 1;
      continue;
    }
    if (distanceToPolylineWithIndex(raw, polyline).distanceM <= maxSnapM) {
      snappedCount += 1;
    }
  }
  return snappedCount;
}
