import { GOOGLE_MAPS_API_KEY, hasGoogleMapsApiKey } from '../../../../shared/constants/googleMaps';
import {
  fetchOsrmDrivingMetrics,
  fetchOsrmDrivingPath,
  type DrivingRouteMetrics,
  type LatLng,
} from './osrmDrivingPath';

export type { DrivingRouteMetrics, LatLng };

/** Decode Google encoded polyline to lat/lng pairs. */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/** Google Directions driving path; falls back to OSRM. */
export async function fetchGoogleDrivingPath(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[] = []
): Promise<LatLng[]> {
  const metrics = await fetchGoogleDrivingRouteMetrics([origin, ...waypoints, destination]);
  return metrics?.polyline ?? fetchOsrmDrivingPath([origin, ...waypoints, destination]);
}

type DirectionsLeg = {
  duration?: { value?: number };
  duration_in_traffic?: { value?: number };
  distance?: { value?: number };
};

function sumLegMetrics(legs: DirectionsLeg[]) {
  let durationSec = 0;
  let distanceM = 0;
  for (const leg of legs) {
    durationSec += leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0;
    distanceM += leg.distance?.value ?? 0;
  }
  return { durationSec, distanceM };
}

/** Google Directions duration/distance with traffic when available; OSRM fallback. */
export async function fetchGoogleDrivingRouteMetrics(
  waypoints: LatLng[]
): Promise<DrivingRouteMetrics | null> {
  const coords = waypoints.filter(isValidCoord);
  if (coords.length < 2) return null;

  if (!hasGoogleMapsApiKey()) {
    return fetchOsrmDrivingMetrics(coords);
  }

  const origin = coords[0]!;
  const destination = coords[coords.length - 1]!;
  const middle = coords.slice(1, -1);

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  if (middle.length > 0) {
    url.searchParams.set(
      'waypoints',
      middle.map((point) => `${point.lat},${point.lng}`).join('|')
    );
  }
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('departure_time', 'now');
  url.searchParams.set('traffic_model', 'best_guess');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return fetchOsrmDrivingMetrics(coords);

    const data = (await response.json()) as {
      status?: string;
      routes?: Array<{
        legs?: DirectionsLeg[];
        overview_polyline?: { points?: string };
      }>;
    };

    const route = data?.routes?.[0];
    const encoded = route?.overview_polyline?.points;
    const legs = route?.legs ?? [];
    if (data.status !== 'OK' || !encoded || legs.length === 0) {
      return fetchOsrmDrivingMetrics(coords);
    }

    const decoded = decodePolyline(encoded);
    if (decoded.length < 2) return fetchOsrmDrivingMetrics(coords);

    const { durationSec, distanceM } = sumLegMetrics(legs);
    return {
      durationSec: Math.max(0, durationSec),
      distanceM: Math.max(0, distanceM),
      polyline: decoded,
      provider: 'google',
    };
  } catch {
    return fetchOsrmDrivingMetrics(coords);
  }
}

function isValidCoord(point: LatLng) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
}
