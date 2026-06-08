import { AppError } from '../../../../shared/errors/app-error';
import { IScheduleRepository, ScheduleListFilters } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { ScheduleStatus } from '../../../../shared/constants/scheduleStatuses';
import { UserRole } from '../../../../shared/constants/roles';
import { mergeCityFilter, normalizeCity } from '../../../../shared/services/cityScope.service';
import {
  DispatchTeamAttributionService,
  shouldAttachDispatchTeamAttribution,
} from '../../../../shared/services/dispatchTeamAttribution.service';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { mapScheduleToResponse } from '../mappers/scheduleResponse.mapper';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';

export class ListSchedulesUseCase {
  private dispatchTeamAttribution: DispatchTeamAttributionService;

  constructor(
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private routeRepo: IRouteRepository,
    userRepo: IUserRepository
  ) {
    this.dispatchTeamAttribution = new DispatchTeamAttributionService(userRepo);
  }

  async execute(
    query: Record<string, string>,
    actor?: { role: UserRole | null; teamId?: string | null; assignedCity?: string | null }
  ) {
    const date = query.date?.trim();
    if (!date) {
      throw new AppError('date query parameter is required (YYYY-MM-DD).', 400);
    }

    const filters: ScheduleListFilters = {
      date,
      city: mergeCityFilter(actor, query.city),
      state: query.state?.trim() || undefined,
      storeId: query.storeId?.trim() || undefined,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
    };
    if (query.status && Object.values(ScheduleStatus).includes(query.status as ScheduleStatus)) {
      filters.status = query.status as ScheduleStatus;
    }

    // Team leads only see schedules that contain routes assigned to their team.
    if (actor?.role === UserRole.TEAM_LEAD) {
      if (!actor.teamId) {
        return { items: [], total: 0, page: filters.page ?? 1, limit: filters.limit ?? 20 };
      }
      const teamRoutes = await this.routeRepo.findMany({
        date,
        teamId: actor.teamId,
        limit: 100,
      });
      const scheduleIds = Array.from(
        new Set(teamRoutes.items.map((route) => route.scheduleId).filter(Boolean))
      ) as string[];
      if (scheduleIds.length === 0) {
        return { items: [], total: 0, page: filters.page ?? 1, limit: filters.limit ?? 20 };
      }
      filters.scheduleIds = scheduleIds;
    }

    const { items, total } = await this.scheduleRepo.findMany(filters);

    const attachDispatchTeam = shouldAttachDispatchTeamAttribution(actor?.role);
    const dispatchTeamByCity = attachDispatchTeam
      ? await this.dispatchTeamAttribution.mapForCities(items.map((s) => s.city))
      : null;

    const data = await Promise.all(
      items.map(async (schedule) => {
        const [store, routeCount, pendingRouteCount] = await Promise.all([
          this.storeRepo.findById(schedule.storeId),
          this.routeRepo.countByScheduleId(schedule.id!),
          this.routeRepo.countPendingRoutesByScheduleId(schedule.id!),
        ]);
        const dispatchTeam = dispatchTeamByCity
          ? dispatchTeamByCity.get(normalizeCity(schedule.city)) ?? null
          : undefined;
        return mapScheduleToResponse(
          schedule,
          store ? mapStoreToResponse(store) : null,
          [],
          { routeCount, pendingRouteCount, dispatchTeam }
        );
      })
    );

    return { items: data, total, page: filters.page ?? 1, limit: filters.limit ?? 20 };
  }
}
