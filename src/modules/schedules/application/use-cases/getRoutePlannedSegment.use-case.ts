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
import {
  polylineEndsNearDestination,
  readPickupCoords,
  readStopDestinationCoords,
} from '../utils/stopDestinationCoords';
import { geocodeMissingRouteStops } from '../services/routeStopGeo.service';
import { scheduleGeocodeContext } from '../utils/geocodeContext';

type Actor = {
  id?: string;
  role: UserRole | null;
  assignedCity?: string | null;
  assignedCities?: string[] | null;
};

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

    if (schedule) {
      await geocodeMissingRouteStops({
        routeStopRepo: this.routeStopRepo,
        routeId,
        geocodeContext: scheduleGeocodeContext({
          city: schedule.city,
          state: schedule.state,
          storeState: schedule.state,
        }),
      });
    }

    const stops = await this.routeStopRepo.findByRouteId(routeId);
    const pickup = stops.find((s) => s.type === 'pickup');
    const pickupCoords = pickup ? readPickupCoords(pickup) : null;

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

    const destCoords = readStopDestinationCoords(nextStop);
    if (!destCoords) {
      throw new AppError('Next stop has no map coordinates.', 400);
    }

    const storedPolyline = route.driverActiveSegmentPolyline ?? [];
    const storedMatchesStop =
      route.driverRouteSegmentStopId === nextStop.id &&
      storedPolyline.length >= 2 &&
      polylineEndsNearDestination(storedPolyline, destCoords);

    if (storedMatchesStop) {
      let distanceM = 0;
      for (let i = 1; i < storedPolyline.length; i += 1) {
        distanceM += haversineMeters(
          storedPolyline[i - 1]!.lat,
          storedPolyline[i - 1]!.lng,
          storedPolyline[i]!.lat,
          storedPolyline[i]!.lng
        );
      }

      return {
        stopId: nextStop.id,
        stopSequence: nextStop.sequence ?? null,
        stopName: nextStop.name,
        stopLat: destCoords.lat,
        stopLng: destCoords.lng,
        polyline: storedPolyline,
        distanceM: Math.round(distanceM),
        routeStatus: route.status,
        progressIndex: route.driverRouteProgressIndex ?? 0,
        segmentVersion: route.driverSegmentVersion ?? 0,
      };
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
      segmentVersion: route.driverSegmentVersion ?? 0,
    };
  }
}
