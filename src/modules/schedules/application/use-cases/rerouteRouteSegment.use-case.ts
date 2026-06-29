import { AppError } from '../../../../shared/errors/app-error';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { fetchGoogleDrivingPath } from '../utils/googleDirectionsPath';
import { haversineMeters } from '../utils/haversine';
import { readStopDestinationCoords } from '../utils/stopDestinationCoords';
import { emitDriverSegmentRerouted } from '../../../chat/socket/chat.socket';

export class RerouteRouteSegmentUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository
  ) {}

  async execute(routeId: string, driverId: string, originLat: number, originLng: number) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);
    if (route.driverId !== driverId) throw new AppError('Access denied.', 403);
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new AppError('Start the route before rerouting.', 400);
    }

    if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) {
      throw new AppError('Valid driver coordinates are required.', 400);
    }

    const stops = await this.routeStopRepo.findByRouteId(routeId);
    const pendingDropoffs = stops
      .filter((s) => s.type === 'dropoff' && s.status === RouteStopStatus.PENDING)
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

    const nextStop = pendingDropoffs[0] ?? null;
    if (!nextStop?.id) {
      throw new AppError('No pending stop to reroute toward.', 400);
    }

    const destCoords = readStopDestinationCoords(nextStop);
    if (!destCoords) {
      throw new AppError('Next stop has no map coordinates.', 400);
    }

    const origin = { lat: originLat, lng: originLng };
    const polyline = await fetchGoogleDrivingPath(origin, destCoords);

    let distanceM = 0;
    for (let i = 1; i < polyline.length; i += 1) {
      distanceM += haversineMeters(
        polyline[i - 1]!.lat,
        polyline[i - 1]!.lng,
        polyline[i]!.lat,
        polyline[i]!.lng
      );
    }

    const segmentVersion = (route.driverSegmentVersion ?? 0) + 1;
    const reroutedAt = new Date();

    await this.routeRepo.update(routeId, {
      driverActiveSegmentPolyline: polyline,
      driverRouteSegmentStopId: nextStop.id,
      driverRouteProgressIndex: 0,
      driverSegmentVersion: segmentVersion,
      driverSegmentReroutedAt: reroutedAt,
    });

    try {
      emitDriverSegmentRerouted({
        routeId,
        scheduleId: route.scheduleId,
        driverId,
        stopId: nextStop.id,
        segmentVersion,
        progressIndex: 0,
        reroutedAt: reroutedAt.toISOString(),
      });
    } catch (error) {
      console.warn('[reroute-segment] socket emit failed', { routeId, error });
    }

    return {
      stopId: nextStop.id,
      stopSequence: nextStop.sequence ?? null,
      stopName: nextStop.name,
      stopLat: destCoords.lat,
      stopLng: destCoords.lng,
      polyline,
      segmentVersion,
      distanceM: Math.round(distanceM),
      progressIndex: 0,
    };
  }
}
