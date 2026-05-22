import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { mapStopsToResponse } from '../utils/routeStops';
import { mapRouteToResponse } from '../mappers/scheduleResponse.mapper';
import type { Route } from '../../domain/entities/route.entity';

export class RouteStopEnrichmentService {
  constructor(private routeStopRepo: IRouteStopRepository) {}

  async enrichRoute(
    route: Route,
    extras?: Parameters<typeof mapRouteToResponse>[1]
  ) {
    const stops = await this.routeStopRepo.findByRouteId(route.id!);
    const mapped = mapStopsToResponse(stops);
    return mapRouteToResponse(route, {
      ...extras,
      pickup: mapped.pickup,
      dropoffs: mapped.dropoffs,
      progress: mapped.progress,
    });
  }

  async enrichRoutes(
    routes: Route[],
    getExtras: (
      route: Route
    ) =>
      | Parameters<typeof mapRouteToResponse>[1]
      | Promise<Parameters<typeof mapRouteToResponse>[1]>
  ) {
    if (routes.length === 0) return [];

    const routeIds = routes.map((r) => r.id!).filter(Boolean);
    const allStops = await this.routeStopRepo.findByRouteIds(routeIds);
    const byRoute = new Map<string, typeof allStops>();
    for (const stop of allStops) {
      const list = byRoute.get(stop.routeId) ?? [];
      list.push(stop);
      byRoute.set(stop.routeId, list);
    }

    return Promise.all(
      routes.map(async (route) => {
        const stops = byRoute.get(route.id!) ?? [];
        const mapped = mapStopsToResponse(stops);
        const extras = await getExtras(route);
        return mapRouteToResponse(route, {
          ...extras,
          pickup: mapped.pickup,
          dropoffs: mapped.dropoffs,
          progress: mapped.progress,
        });
      })
    );
  }
}
