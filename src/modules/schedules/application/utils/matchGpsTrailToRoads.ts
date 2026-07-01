import { GOOGLE_MAPS_API_KEY, hasGoogleMapsApiKey } from '../../../../shared/constants/googleMaps';
import { distanceToPolylineM } from './distanceToPolyline';
import { haversineMeters } from './haversine';
import type { LatLng } from './osrmDrivingPath';

const GOOGLE_SNAP_CHUNK_SIZE = 100;
const SNAP_QUALITY_THRESHOLD_M = 30;
const DEFAULT_ANCHOR_MAX_DISTANCE_M = 100;

export type GpsTrailPoint = { lat: number; lng: number; recordedAt: Date };

export type RoadMatchProvider = 'google' | 'osrm' | 'raw';

export type MatchGpsTrailOptions = {
  anchorPoint?: LatLng | null;
  maxAnchorDistanceM?: number;
};

export type RoadMatchResult = {
  points: GpsTrailPoint[];
  provider: RoadMatchProvider;
  inputCount: number;
  outputCount: number;
};

type SnapChunkResult = {
  points: LatLng[];
  snapped: boolean;
};

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

function appendMatchedSegment(existing: LatLng[], segment: LatLng[]) {
  if (segment.length === 0) return;
  if (existing.length === 0) {
    existing.push(...segment);
    return;
  }
  const prev = existing[existing.length - 1]!;
  const first = segment[0]!;
  if (prev.lat === first.lat && prev.lng === first.lng) {
    existing.push(...segment.slice(1));
  } else {
    existing.push(...segment);
  }
}

/** True when output looks road-snapped (denser or input hugs the polyline). */
export function looksSnappedToRoads(input: LatLng[], output: LatLng[]): boolean {
  if (output.length < 2 || input.length < 2) return false;
  if (output.length > input.length) return true;

  let totalDistanceM = 0;
  for (const point of input) {
    totalDistanceM += distanceToPolylineM(point, output);
  }
  const averageDistanceM = totalDistanceM / input.length;
  return averageDistanceM <= SNAP_QUALITY_THRESHOLD_M;
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

async function snapChunkWithGoogle(
  points: LatLng[],
  interpolate = true,
  minOutputPoints = 2
): Promise<SnapChunkResult> {
  if (points.length === 0) return { points: [], snapped: false };
  if (!hasGoogleMapsApiKey()) {
    console.warn('[road-match] Google Snap to Roads skipped — GOOGLE_MAPS_API_KEY not set');
    return { points, snapped: false };
  }

  const path = points.map((p) => `${p.lat},${p.lng}`).join('|');
  const url = new URL('https://roads.googleapis.com/v1/snapToRoads');
  url.searchParams.set('path', path);
  url.searchParams.set('interpolate', interpolate ? 'true' : 'false');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      const body = await response.text();
      console.warn('[road-match] Google Snap to Roads HTTP error', {
        status: response.status,
        body: body.slice(0, 300),
      });
      return { points, snapped: false };
    }

    const data = (await response.json()) as {
      snappedPoints?: Array<{ location?: { latitude?: number; longitude?: number } }>;
      error?: { message?: string; status?: string };
    };

    if (data.error?.message) {
      console.warn('[road-match] Google Snap to Roads API error', data.error);
      return { points, snapped: false };
    }

    const snapped = (data.snappedPoints ?? [])
      .map((entry) => ({
        lat: Number(entry.location?.latitude),
        lng: Number(entry.location?.longitude),
      }))
      .filter(isValidPoint);

    if (snapped.length < minOutputPoints) {
      console.warn('[road-match] Google Snap to Roads returned too few points', {
        input: points.length,
        output: snapped.length,
      });
      return { points, snapped: false };
    }

    return { points: snapped, snapped: true };
  } catch (error) {
    console.warn('[road-match] Google Snap to Roads request failed', { error });
    return { points, snapped: false };
  }
}

/** Snap one GPS point to the nearest road without path interpolation. */
export async function snapSinglePointToRoads(point: LatLng): Promise<LatLng> {
  if (!isValidPoint(point)) return point;
  if (!hasGoogleMapsApiKey()) return point;

  const result = await snapChunkWithGoogle([point], false, 1);
  return result.snapped ? result.points[0] ?? point : point;
}

function trimAnchorPrefix(matched: LatLng[], batchStart: LatLng): LatLng[] {
  if (matched.length <= 1) return matched;

  let bestIndex = 0;
  let bestDistanceM = Infinity;
  for (let i = 0; i < matched.length; i += 1) {
    const candidate = matched[i]!;
    const distanceM = haversineMeters(candidate.lat, candidate.lng, batchStart.lat, batchStart.lng);
    if (distanceM < bestDistanceM) {
      bestDistanceM = distanceM;
      bestIndex = i;
    }
  }

  return matched.slice(bestIndex);
}

async function matchWithGoogle(coords: LatLng[]): Promise<{ points: LatLng[]; ok: boolean }> {
  const matched: LatLng[] = [];
  let allChunksSnapped = true;

  for (let i = 0; i < coords.length; i += GOOGLE_SNAP_CHUNK_SIZE) {
    const chunk = coords.slice(i, i + GOOGLE_SNAP_CHUNK_SIZE);
    const result = await snapChunkWithGoogle(chunk);
    if (!result.snapped) {
      allChunksSnapped = false;
      break;
    }
    appendMatchedSegment(matched, result.points);
  }

  if (!allChunksSnapped || matched.length < 2) {
    return { points: coords, ok: false };
  }

  if (!looksSnappedToRoads(coords, matched)) {
    console.warn('[road-match] Google output does not look road-snapped', {
      input: coords.length,
      output: matched.length,
    });
    return { points: coords, ok: false };
  }

  return { points: matched, ok: true };
}

async function matchWithOsrm(points: LatLng[]): Promise<{ points: LatLng[]; ok: boolean }> {
  if (points.length < 2) return { points, ok: false };

  const coordString = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/match/v1/driving/${coordString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      console.warn('[road-match] OSRM match HTTP error', {
        status: response.status,
        body: body.slice(0, 200),
      });
      return { points, ok: false };
    }

    const data = (await response.json()) as {
      matchings?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
      code?: string;
      message?: string;
    };

    const coords = data.matchings?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      console.warn('[road-match] OSRM match returned no geometry', {
        code: data.code,
        message: data.message,
      });
      return { points, ok: false };
    }

    const matched = coords.map(([lng, lat]) => ({ lat, lng }));
    if (!looksSnappedToRoads(points, matched)) {
      return { points, ok: false };
    }

    return { points: matched, ok: true };
  } catch (error) {
    console.warn('[road-match] OSRM match request failed', { error });
    return { points, ok: false };
  }
}

/** Google Snap-to-Roads with OSRM match fallback; returns provider used. */
export async function matchGpsTrailToRoads(
  points: GpsTrailPoint[],
  options: MatchGpsTrailOptions = {}
): Promise<RoadMatchResult> {
  const valid = points.filter((p) => isValidPoint(p) && !Number.isNaN(p.recordedAt.getTime()));
  if (valid.length < 2) {
    return {
      points: valid,
      provider: 'raw',
      inputCount: valid.length,
      outputCount: valid.length,
    };
  }

  const startAt = valid[0]!.recordedAt;
  const endAt = valid[valid.length - 1]!.recordedAt;
  let coords = dedupeConsecutive(valid.map((p) => ({ lat: p.lat, lng: p.lng })));

  if (coords.length < 2) {
    return {
      points: valid,
      provider: 'raw',
      inputCount: valid.length,
      outputCount: valid.length,
    };
  }

  const batchStart = coords[0]!;
  const anchorPoint = options.anchorPoint ?? null;
  const maxAnchorDistanceM = options.maxAnchorDistanceM ?? DEFAULT_ANCHOR_MAX_DISTANCE_M;
  const anchorUsed =
    anchorPoint != null &&
    isValidPoint(anchorPoint) &&
    haversineMeters(anchorPoint.lat, anchorPoint.lng, batchStart.lat, batchStart.lng) <=
      maxAnchorDistanceM;

  if (anchorUsed) {
    coords = dedupeConsecutive([anchorPoint, ...coords]);
  }

  let provider: RoadMatchProvider = 'raw';
  let matchedCoords: LatLng[] = coords;

  if (hasGoogleMapsApiKey()) {
    const google = await matchWithGoogle(coords);
    if (google.ok) {
      matchedCoords = anchorUsed ? trimAnchorPrefix(google.points, batchStart) : google.points;
      provider = 'google';
    }
  }

  if (provider === 'raw') {
    const osrm = await matchWithOsrm(coords);
    if (osrm.ok) {
      matchedCoords = anchorUsed ? trimAnchorPrefix(osrm.points, batchStart) : osrm.points;
      provider = 'osrm';
    } else if (anchorUsed) {
      matchedCoords = coords.slice(1);
    }
  }

  if (matchedCoords.length < 2) {
    return {
      points: valid,
      provider: 'raw',
      inputCount: coords.length,
      outputCount: valid.length,
    };
  }

  const timed =
    provider === 'raw'
      ? valid
      : assignInterpolatedTimestamps(matchedCoords, startAt, endAt);

  console.log('[road-match]', {
    provider,
    input: coords.length,
    output: timed.length,
    anchorUsed,
  });

  return {
    points: timed,
    provider,
    inputCount: coords.length,
    outputCount: timed.length,
  };
}
