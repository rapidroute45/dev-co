import { GOOGLE_MAPS_API_KEY, hasGoogleMapsApiKey } from '../../../../shared/constants/googleMaps';
import { fetchOsrmDrivingPath, type LatLng } from './osrmDrivingPath';

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
  destination: LatLng
): Promise<LatLng[]> {
  if (!hasGoogleMapsApiKey()) {
    return fetchOsrmDrivingPath([origin, destination]);
  }

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return fetchOsrmDrivingPath([origin, destination]);

    const data = (await response.json()) as {
      status?: string;
      routes?: Array<{ overview_polyline?: { points?: string } }>;
    };

    const encoded = data?.routes?.[0]?.overview_polyline?.points;
    if (data.status === 'OK' && encoded) {
      const decoded = decodePolyline(encoded);
      if (decoded.length >= 2) return decoded;
    }

    return fetchOsrmDrivingPath([origin, destination]);
  } catch {
    return fetchOsrmDrivingPath([origin, destination]);
  }
}
