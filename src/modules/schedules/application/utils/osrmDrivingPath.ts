export type LatLng = { lat: number; lng: number };

/** OSRM driving polyline between ordered waypoints. Falls back to straight segments. */
export async function fetchOsrmDrivingPath(waypoints: LatLng[]): Promise<LatLng[]> {
  if (waypoints.length < 2) return waypoints;

  const coordString = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) return waypoints;
    const data = (await response.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return waypoints;
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return waypoints;
  }
}
