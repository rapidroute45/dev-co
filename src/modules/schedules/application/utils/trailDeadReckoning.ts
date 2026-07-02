import type { GpsTrailPoint } from './matchGpsTrailToRoads';
import { haversineMeters } from './haversine';
import type { LatLng } from './osrmDrivingPath';
import { assignInterpolatedTimestamps } from './matchGpsTrailToRoads';

export const SNAP_MIN_RATIO = 0.15;
export const SNAP_MIN_INPUT_FOR_RATIO = 10;

export function shouldRejectSnapRatio(inputCount: number, outputCount: number): boolean {
  if (inputCount < SNAP_MIN_INPUT_FOR_RATIO) return false;
  if (outputCount === 0) return true;
  return outputCount / inputCount < SNAP_MIN_RATIO;
}

function densifySegment(start: LatLng, end: LatLng, steps: number): LatLng[] {
  if (steps <= 1) return [end];
  const points: LatLng[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    });
  }
  return points;
}

/**
 * Linear dead-reckoning between anchors when road snap quality is too low.
 * Keeps timestamps aligned with the raw batch window.
 */
export function interpolateTrailBetweenAnchors(
  startAnchor: GpsTrailPoint | null,
  endAnchor: GpsTrailPoint,
  rawPoints: GpsTrailPoint[]
): GpsTrailPoint[] {
  const startAt = startAnchor?.recordedAt ?? rawPoints[0]?.recordedAt ?? endAnchor.recordedAt;
  const endAt = endAnchor.recordedAt;

  const start: LatLng = startAnchor
    ? { lat: startAnchor.lat, lng: startAnchor.lng }
    : { lat: rawPoints[0]?.lat ?? endAnchor.lat, lng: rawPoints[0]?.lng ?? endAnchor.lng };
  const end: LatLng = { lat: endAnchor.lat, lng: endAnchor.lng };

  const spanM = haversineMeters(start.lat, start.lng, end.lat, end.lng);
  const stepM = 15;
  const steps = Math.max(2, Math.min(40, Math.ceil(spanM / stepM)));

  const coords = densifySegment(start, end, steps);
  return assignInterpolatedTimestamps(coords, startAt, endAt);
}
