import { haversineMeters } from './haversine';

type LatLng = { lat: number; lng: number };

function projectOnSegment(point: LatLng, a: LatLng, b: LatLng) {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return {
      lat: a.lat,
      lng: a.lng,
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
    distanceM: haversineMeters(point.lat, point.lng, lat, lng),
  };
}

export function distanceToPolylineM(point: LatLng, polyline: LatLng[]): number {
  if (!polyline.length) return Infinity;
  if (polyline.length === 1) {
    return haversineMeters(point.lat, point.lng, polyline[0]!.lat, polyline[0]!.lng);
  }

  let bestDistanceM = Infinity;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const projected = projectOnSegment(point, polyline[i]!, polyline[i + 1]!);
    if (projected.distanceM < bestDistanceM) {
      bestDistanceM = projected.distanceM;
    }
  }
  return bestDistanceM;
}
