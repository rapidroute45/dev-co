import { haversineMeters } from './haversine';

/** Stored coords vs fresh geocode — beyond this we trust the address geocode. */
export const STOP_COORD_DRIFT_THRESHOLD_M = 100_000;

/** Planned segment polyline end must be within this of the stop destination. */
export const SEGMENT_POLYLINE_END_THRESHOLD_M = 50_000;

/** Max plausible jump between consecutive GPS path points (~50 km). */
export const GPS_PATH_MAX_JUMP_M = 50_000;

type StopLike = {
  destinationLat?: number | null;
  destinationLng?: number | null;
  lat?: number | null;
  lng?: number | null;
};

export function readStopDestinationCoords(stop: StopLike | null | undefined) {
  if (!stop) return null;
  const lat = stop.destinationLat;
  const lng = stop.destinationLng;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

/** Pickup may fall back to legacy lat/lng when destination was never set. */
export function readPickupCoords(stop: StopLike | null | undefined) {
  const fromDestination = readStopDestinationCoords(stop);
  if (fromDestination) return fromDestination;
  if (!stop) return null;
  const lat = stop.lat;
  const lng = stop.lng;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

export function polylineEndsNearDestination(
  polyline: { lat: number; lng: number }[],
  destination: { lat: number; lng: number },
  thresholdM = SEGMENT_POLYLINE_END_THRESHOLD_M
): boolean {
  if (!polyline.length) return false;
  const end = polyline[polyline.length - 1]!;
  return haversineMeters(end.lat, end.lng, destination.lat, destination.lng) <= thresholdM;
}

export function filterGpsPathOutliers<T extends { lat: number; lng: number }>(
  points: T[],
  maxJumpM = GPS_PATH_MAX_JUMP_M
): T[] {
  if (points.length <= 1) return points;

  const kept: T[] = [points[0]!];
  for (let i = 1; i < points.length; i += 1) {
    const prev = kept[kept.length - 1]!;
    const next = points[i]!;
    if (haversineMeters(prev.lat, prev.lng, next.lat, next.lng) <= maxJumpM) {
      kept.push(next);
    }
  }
  return kept;
}

/** Drop batch points that teleport unrealistically far from the last known position. */
export function filterIncomingGpsBatch<T extends { lat: number; lng: number }>(
  points: T[],
  anchor: { lat: number; lng: number } | null,
  maxJumpM = GPS_PATH_MAX_JUMP_M
): T[] {
  if (points.length === 0) return points;

  let ref = anchor;
  const kept: T[] = [];

  for (const point of points) {
    if (!ref) {
      kept.push(point);
      ref = { lat: point.lat, lng: point.lng };
      continue;
    }
    if (haversineMeters(ref.lat, ref.lng, point.lat, point.lng) <= maxJumpM) {
      kept.push(point);
      ref = { lat: point.lat, lng: point.lng };
    }
  }

  return kept;
}
