import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import type { Route } from '../../domain/entities/route.entity';
import { fetchGoogleDrivingRouteMetrics } from './googleDirectionsPath';
import { readPickupCoords, readStopDestinationCoords } from './stopDestinationCoords';
import type { LatLng } from './osrmDrivingPath';

type StopLike = {
  status?: string | null;
  lat?: number | null;
  lng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
};

function readStopCoords(stop: StopLike | null | undefined): LatLng | null {
  if (!stop) return null;
  const fromDestination = readStopDestinationCoords(stop);
  if (fromDestination) return fromDestination;
  const lat = stop.lat;
  const lng = stop.lng;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
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

/** Google/OSRM driving ETA for the full route or remaining stops when in progress. */
export async function estimateRouteDriveDurationSec(params: {
  route: Route;
  pickup?: StopLike | null;
  dropoffs?: StopLike[];
}): Promise<number | null> {
  const dropoffs = [...(params.dropoffs ?? [])].sort(
    (a, b) => Number((a as { sequence?: number }).sequence ?? 0) - Number((b as { sequence?: number }).sequence ?? 0)
  );

  const pendingDropoffs = dropoffs.filter(
    (stop) => !stop.status || stop.status === RouteStopStatus.PENDING
  );
  const targetStops =
    params.route.status === RouteStatus.IN_PROGRESS ? pendingDropoffs : dropoffs;

  const stopCoords = targetStops
    .map((stop) => readStopCoords(stop))
    .filter((coords): coords is LatLng => coords != null);

  if (stopCoords.length === 0) return null;

  let origin: LatLng | null = null;
  if (
    params.route.status === RouteStatus.IN_PROGRESS &&
    params.route.driverLat != null &&
    params.route.driverLng != null &&
    Number.isFinite(params.route.driverLat) &&
    Number.isFinite(params.route.driverLng)
  ) {
    origin = { lat: params.route.driverLat, lng: params.route.driverLng };
  } else {
    origin = readStopCoords(params.pickup ?? null) ?? readPickupCoords(params.pickup ?? null);
  }

  if (!origin) return null;

  const waypoints = dedupeConsecutive([origin, ...stopCoords]);
  if (waypoints.length < 2) return null;

  const metrics = await fetchGoogleDrivingRouteMetrics(waypoints);
  return metrics?.durationSec ?? null;
}
