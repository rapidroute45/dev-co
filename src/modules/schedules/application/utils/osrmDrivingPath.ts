export type LatLng = { lat: number; lng: number };

export type DrivingRouteMetrics = {
  durationSec: number;
  distanceM: number;
  polyline: LatLng[];
  provider: 'google' | 'osrm';
};

function isValidCoord(point: LatLng) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

/** OSRM driving polyline between ordered waypoints. Falls back to straight segments. */
export async function fetchOsrmDrivingPath(waypoints: LatLng[]): Promise<LatLng[]> {
  const metrics = await fetchOsrmDrivingMetrics(waypoints);
  return metrics?.polyline ?? waypoints;
}

/** OSRM route duration and distance for ordered waypoints. */
export async function fetchOsrmDrivingMetrics(
  waypoints: LatLng[]
): Promise<DrivingRouteMetrics | null> {
  if (waypoints.length < 2) return null;

  const coordString = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      routes?: Array<{
        duration?: number;
        distance?: number;
        geometry?: { coordinates?: [number, number][] };
      }>;
    };
    const route = data?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!route || !Array.isArray(coords) || coords.length < 2) return null;

    return {
      durationSec: Math.max(0, Math.round(route.duration ?? 0)),
      distanceM: Math.max(0, Math.round(route.distance ?? 0)),
      polyline: coords.map(([lng, lat]) => ({ lat, lng })),
      provider: 'osrm',
    };
  } catch {
    return null;
  }
}
