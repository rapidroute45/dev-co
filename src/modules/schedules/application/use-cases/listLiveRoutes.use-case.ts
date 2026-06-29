import { AppError } from '../../../../shared/errors/app-error';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { UserRole } from '../../../../shared/constants/roles';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { parseScheduleDate } from '../utils/scheduleDate';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import {
  mergeCityListFilter,
  resolveGlobalLocationQuery,
} from '../../../../shared/services/cityScope.service';

const LIVE_STATUSES = new Set<RouteStatus>([
  RouteStatus.IN_PROGRESS,
  RouteStatus.ACTIVE,
]);

export class ListLiveRoutesUseCase {
  constructor(
    private routeRepo: IRouteRepository,
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
    if (
      actor?.role !== UserRole.ADMIN &&
      actor?.role !== UserRole.DISPATCH_MANAGER &&
      actor?.role !== UserRole.DISPATCH_TEAM
    ) {
      throw new AppError('Access denied.', 403);
    }

    const date = query.date?.trim();
    if (!date) {
      throw new AppError('date query parameter is required (YYYY-MM-DD).', 400);
    }

    parseScheduleDate(date);

    const scopedQuery = resolveGlobalLocationQuery(actor, query);
    const cityFilter = mergeCityListFilter(actor, scopedQuery.city);

    let scheduleIds: string[] | undefined;
    if (cityFilter.city || cityFilter.cities?.length || scopedQuery.state || scopedQuery.storeId) {
      const { items: schedules } = await this.scheduleRepo.findMany({
        date,
        city: cityFilter.city,
        cities: cityFilter.cities,
        state: scopedQuery.state?.trim()?.toUpperCase(),
        storeId: scopedQuery.storeId?.trim(),
        page: 1,
        limit: 500,
      });
      scheduleIds = schedules.map((s) => s.id!).filter(Boolean);
      if (scheduleIds.length === 0) {
        return { date, items: [], count: 0 };
      }
    }

    const { items: routes } = await this.routeRepo.findMany({
      date,
      scheduleIds,
      page: 1,
      limit: 200,
    });

    const liveRoutes = routes.filter(
      (route) => route.driverId && LIVE_STATUSES.has(route.status as RouteStatus)
    );

    const items = await Promise.all(
      liveRoutes.map(async (route) => {
        const [team, driver, schedule] = await Promise.all([
          this.teamRepo.findById(route.teamId),
          route.driverId ? this.userRepo.findById(route.driverId) : Promise.resolve(null),
          this.scheduleRepo.findById(route.scheduleId),
        ]);
        const store = schedule ? await this.storeRepo.findById(schedule.storeId) : null;

        const routeDto = await this.routeStopEnrichment.enrichRoute(route, {
          teamName: team?.name,
          teamCode: team?.code,
          driverEmail: driver?.email,
          driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : null,
        });

        return {
          ...routeDto,
          schedule: schedule
            ? {
                city: schedule.city,
                state: schedule.state,
                storeName: store?.storeName ?? null,
              }
            : null,
        };
      })
    );

    return { date, items, count: items.length };
  }
}
