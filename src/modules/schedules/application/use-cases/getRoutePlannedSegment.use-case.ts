import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { enforceActorCity } from '../../../../shared/services/cityScope.service';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { fetchOsrmDrivingPath } from '../utils/osrmDrivingPath';
import { haversineMeters } from '../utils/haversine';

type Actor = {
  id?: string;
  role: UserRole | null;
  assignedCity?: string | null;
  assignedCities?: string[] | null;
};

function readStopCoords(stop: {
  destinationLat?: number | null;
  destinationLng?: number | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const lat = stop.destinationLat ?? stop.lat;
  const lng = stop.destinationLng ?? stop.lng;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

export class GetRoutePlannedSegmentUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private scheduleRepo: IScheduleRepository
  ) {}

  private assertViewer(actor: Actor | undefined, routeDriverId: string | null) {
    if (!actor?.id) throw new AppError('Unauthorized', 401);

    const isDriver =
      (actor.role === UserRole.DRIVER || actor.role === UserRole.TEAM_DRIVER) &&
      routeDriverId === actor.id;
    const isOps =
      actor.role === UserRole.ADMIN ||
      actor.role === UserRole.DISPATCH_MANAGER ||
      actor.role === UserRole.DISPATCH_TEAM;

    if (!isDriver && !isOps) {
      throw new AppError('Access denied.', 403);
    }
  }

  async execute(routeId: string, actor?: Actor) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);

    this.assertViewer(actor, route.driverId);

    const schedule = await this.scheduleRepo.findById(route.scheduleId);
    if (schedule && actor?.role !== UserRole.TEAM_DRIVER && actor?.role !== UserRole.DRIVER) {
      enforceActorCity(actor, schedule.city);
    }

    const stops = await this.routeStopRepo.findByRouteId(routeId);
    const pickup = stops.find((s) => s.type === 'pickup');
    const pickupCoords = pickup ? readStopCoords(pickup) : null;

    const pendingDropoffs = stops
      .filter((s) => s.type === 'dropoff' && s.status === RouteStopStatus.PENDING)
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

    const nextStop = pendingDropoffs[0] ?? null;
    if (!nextStop?.id) {
      return {
        stopId: null,
        stopSequence: null,
        stopName: null,
        polyline: [] as { lat: number; lng: number }[],
        distanceM: 0,
      };
    }

    const destCoords = readStopCoords(nextStop);
    if (!destCoords) {
      throw new AppError('Next stop has no map coordinates.', 400);
    }

    const origin =
      route.driverLat != null &&
      route.driverLng != null &&
      Number.isFinite(route.driverLat) &&
      Number.isFinite(route.driverLng)
        ? { lat: route.driverLat, lng: route.driverLng }
        : pickupCoords;

    if (!origin) {
      throw new AppError('No origin for planned segment (share location or geocode pickup).', 400);
    }

    const polyline = await fetchOsrmDrivingPath([origin, destCoords]);
    let distanceM = 0;
    for (let i = 1; i < polyline.length; i += 1) {
      distanceM += haversineMeters(
        polyline[i - 1]!.lat,
        polyline[i - 1]!.lng,
        polyline[i]!.lat,
        polyline[i]!.lng
      );
    }

    return {
      stopId: nextStop.id,
      stopSequence: nextStop.sequence ?? null,
      stopName: nextStop.name,
      stopLat: destCoords.lat,
      stopLng: destCoords.lng,
      polyline,
      distanceM: Math.round(distanceM),
      routeStatus: route.status,
      progressIndex: route.driverRouteProgressIndex ?? 0,
    };
  }
}
