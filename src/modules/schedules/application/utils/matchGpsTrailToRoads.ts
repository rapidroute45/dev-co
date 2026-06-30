import { GOOGLE_MAPS_API_KEY, hasGoogleMapsApiKey } from '../../../../shared/constants/googleMaps';
import type { LatLng } from './osrmDrivingPath';

const GOOGLE_SNAP_CHUNK_SIZE = 100;

export type GpsTrailPoint = { lat: number; lng: number; recordedAt: Date };

function isValidPoint(point: { lat: number; lng: number }) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

function dedupeConsecutive(points: LatLng[]): LatLng[] {
  if (points.length <= 1) return points;
  const kept: LatLng[] = [points[0]!];
  for (let i = 1; i < points.length; i += 1) {
    const prev = kept[kept.length - 1]!;
    const next = points[i]!;
    if (prev.lat !== next.lat || prev.lng !== next.lng) {
      kept.push(next);
    }
  }
  return kept;
}

/** Spread matched geometry across the batch time window for mergeRoutePathPoints. */
export function assignInterpolatedTimestamps(
  points: LatLng[],
  startAt: Date,
  endAt: Date
): GpsTrailPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{ lat: points[0]!.lat, lng: points[0]!.lng, recordedAt: endAt }];
  }

  const startMs = startAt.getTime();
  const endMs = endAt.getTime();
  const span = Math.max(1, endMs - startMs);

  return points.map((point, index) => ({
    lat: point.lat,
    lng: point.lng,
    recordedAt: new Date(startMs + (span * index) / (points.length - 1)),
  }));
}

async function snapChunkWithGoogle(points: LatLng[]): Promise<LatLng[]> {
  if (points.length === 0) return [];
  if (!hasGoogleMapsApiKey()) return points;

  const path = points.map((p) => `${p.lat},${p.lng}`).join('|');
  const url = new URL('https://roads.googleapis.com/v1/snapToRoads');
  url.searchParams.set('path', path);
  url.searchParams.set('interpolate', 'true');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) return points;

  const data = (await response.json()) as {
    snappedPoints?: Array<{ location?: { latitude?: number; longitude?: number } }>;
  };

  const snapped = (data.snappedPoints ?? [])
    .map((entry) => ({
      lat: Number(entry.location?.latitude),
      lng: Number(entry.location?.longitude),
    }))
    .filter(isValidPoint);

  return snapped.length >= 2 ? snapped : points;
}

async function matchWithOsrm(points: LatLng[]): Promise<LatLng[]> {
  if (points.length < 2) return points;

  const coordString = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/match/v1/driving/${coordString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) return points;
    const data = (await response.json()) as {
      matchings?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    const coords = data.matchings?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return points;
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return points;
  }
}

/** Google Snap-to-Roads with OSRM match fallback. */
export async function matchGpsTrailToRoads(points: GpsTrailPoint[]): Promise<GpsTrailPoint[]> {
  const valid = points.filter((p) => isValidPoint(p) && !Number.isNaN(p.recordedAt.getTime()));
  if (valid.length < 2) return valid;

  const startAt = valid[0]!.recordedAt;
  const endAt = valid[valid.length - 1]!.recordedAt;
  const coords = dedupeConsecutive(valid.map((p) => ({ lat: p.lat, lng: p.lng })));

  if (coords.length < 2) return valid;

  let matched: LatLng[] = [];

  if (hasGoogleMapsApiKey()) {
    for (let i = 0; i < coords.length; i += GOOGLE_SNAP_CHUNK_SIZE) {
      const chunk = coords.slice(i, i + GOOGLE_SNAP_CHUNK_SIZE);
      const snapped = await snapChunkWithGoogle(chunk);
      if (matched.length > 0 && snapped.length > 0) {
        const prev = matched[matched.length - 1]!;
        const first = snapped[0]!;
        if (prev.lat === first.lat && prev.lng === first.lng) {
          matched.push(...snapped.slice(1));
        } else {
          matched.push(...snapped);
        }
      } else {
        matched.push(...snapped);
      }
    }
  }

  if (matched.length < 2) {
    matched = await matchWithOsrm(coords);
  }

  if (matched.length < 2) {
    return valid;
  }

  return assignInterpolatedTimestamps(matched, startAt, endAt);
}
