import { AppError } from '../../../../shared/errors/app-error';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { UserRole } from '../../../../shared/constants/roles';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { mapStopsToResponse } from '../utils/routeStops';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { mergeCityListFilter, enforceActorCity } from '../../../../shared/services/cityScope.service';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';

const TRACKING_ROLES = new Set([
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.DISPATCH_TEAM,
]);

export class ListLiveRoutesUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository,
    private routeStopEnrichment: RouteStopEnrichmentService
  ) {}

  async execute(
    query: Record<string, string>,
    actor?: {
      role: UserRole | null;
      assignedCity?: string | null;
      assignedCities?: string[] | null;
    }
  ) {
    if (!actor?.role || !TRACKING_ROLES.has(actor.role)) {
      throw new AppError('Access denied.', 403);
    }

    const date = query.date?.trim();
    if (!date) {
      throw new AppError('date query parameter is required (YYYY-MM-DD).', 400);
    }

    const cityFilter = mergeCityListFilter(actor, query.city);
    const state = query.state?.trim();
    const storeId = query.storeId?.trim();

    let scheduleIds: string[] | undefined;
    if (cityFilter.city || cityFilter.cities?.length || state || storeId) {
      const { items: schedules } = await this.scheduleRepo.findMany({
        date,
        city: cityFilter.city,
        cities: cityFilter.cities,
        state,
        storeId,
        page: 1,
        limit: 500,
      });
      scheduleIds = schedules.map((s) => s.id!).filter(Boolean);
      if (scheduleIds.length === 0) {
        return { items: [], date };
      }
    }

    const { items: routes } = await this.routeRepo.findMany({
      date,
      status: RouteStatus.IN_PROGRESS,
      scheduleIds,
      limit: 200,
    });

    const scheduleCache = new Map<string, Awaited<ReturnType<IScheduleRepository['findById']>>>();
    const storeCache = new Map<string, Awaited<ReturnType<IStoreRepository['findById']>>>();

    const items = [];
    for (const route of routes) {
      if (!route.driverId) continue;
      if (route.driverLat == null || route.driverLng == null) continue;

      let schedule = scheduleCache.get(route.scheduleId);
      if (schedule === undefined) {
        schedule = await this.scheduleRepo.findById(route.scheduleId);
        scheduleCache.set(route.scheduleId, schedule);
      }
      if (!schedule) continue;

      try {
        enforceActorCity(actor, schedule.city);
      } catch {
        continue;
      }

      let store = storeCache.get(schedule.storeId);
      if (store === undefined) {
        store = await this.storeRepo.findById(schedule.storeId);
        storeCache.set(schedule.storeId, store);
      }

      const team = await this.teamRepo.findById(route.teamId);
      const driver = await this.userRepo.findById(route.driverId);
      const stops = await this.routeStopRepo.findByRouteId(route.id!);
      const mappedStops = mapStopsToResponse(stops);
      const enriched = await this.routeStopEnrichment.enrichRoute(route, {
        teamName: team?.name,
        teamCode: team?.code,
        driverEmail: driver?.email,
        driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : null,
        driverLocation: {
          lat: route.driverLat,
          lng: route.driverLng,
          updatedAt: route.driverLocationAt,
        },
      });

      items.push({
        ...enriched,
        progress: mappedStops.progress,
        schedule: {
          id: schedule.id,
          date: schedule.date,
          city: schedule.city,
          state: schedule.state,
          storeId: schedule.storeId,
          storeName: store?.storeName ?? null,
        },
      });
    }

    return { items, date };
  }
}
