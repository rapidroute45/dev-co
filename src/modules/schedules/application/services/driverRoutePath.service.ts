import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { DriverLocationRepository } from '../../infrastructure/repositories/driverLocation.repository';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import type { Route } from '../../domain/entities/route.entity';

export type DriverRoutePathPoint = {
  lat: number;
  lng: number;
  recordedAt: Date;
};

function isFinishedRoute(status: string) {
  return status === RouteStatus.COMPLETED || status === RouteStatus.NOT_VERIFIED;
}

export function mapLocationTrailToPath(
  points: { lat: number; lng: number; recordedAt: Date }[]
): DriverRoutePathPoint[] {
  return points.map((point) => ({
    lat: point.lat,
    lng: point.lng,
    recordedAt: point.recordedAt,
  }));
}

export class DriverRoutePathService {
  constructor(
    private routeRepo: IRouteRepository,
    private driverLocationRepo: DriverLocationRepository
  ) {}

  async buildSnapshotFromLive(routeId: string): Promise<DriverRoutePathPoint[]> {
    const live = await this.driverLocationRepo.listByRoute(routeId);
    return mapLocationTrailToPath(live);
  }

  /** Persist GPS trail on the route when the driver finishes (or backfill legacy routes). */
  async ensureSavedIfCompleted(route: Route): Promise<DriverRoutePathPoint[]> {
    if (!route.id || !isFinishedRoute(route.status)) return route.driverRoutePath ?? [];

    if (route.driverRoutePath && route.driverRoutePath.length >= 2) {
      return route.driverRoutePath;
    }

    const snapshot = await this.buildSnapshotFromLive(route.id);
    if (snapshot.length >= 2) {
      await this.routeRepo.update(route.id, { driverRoutePath: snapshot });
    }
    return snapshot;
  }
}
