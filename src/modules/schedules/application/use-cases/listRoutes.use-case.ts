import { AppError } from '../../../../shared/errors/app-error';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { UserRole } from '../../../../shared/constants/roles';
import { IRouteRepository, RouteListFilters } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { mapRouteToResponse } from '../mappers/scheduleResponse.mapper';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';
import { formatScheduleDate } from '../utils/scheduleDate';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { mergeCityListFilter, normalizeCity, resolveGlobalLocationQuery } from '../../../../shared/services/cityScope.service';
import {
  DispatchTeamAttributionService,
  shouldAttachDispatchTeamAttribution,
} from '../../../../shared/services/dispatchTeamAttribution.service';
import { TeamLeadScheduleAlertService } from '../services/teamLeadScheduleAlert.service';

export class ListRoutesUseCase {
  private dispatchTeamAttribution: DispatchTeamAttributionService;

  constructor(
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository,
    private teamLeadAlertService: TeamLeadScheduleAlertService
  ) {
    this.dispatchTeamAttribution = new DispatchTeamAttributionService(userRepo);
  }

  async execute(
    query: Record<string, string>,
    actor?: {
      id?: string;
      role: UserRole | null;
      teamId?: string | null;
      assignedCity?: string | null;
      assignedCities?: string[] | null;
    }
  ) {
    const date = query.date?.trim();
    if (!date) {
      throw new AppError('date query parameter is required (YYYY-MM-DD).', 400);
    }

    const filters: RouteListFilters = {
      date,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    if (query.status && Object.values(RouteStatus).includes(query.status as RouteStatus)) {
      filters.status = query.status as RouteStatus;
    }

    // Team leads only ever see their own team's routes (any city).
    if (actor?.role === UserRole.TEAM_LEAD) {
      if (!actor.teamId) {
        return { items: [], total: 0, page: filters.page ?? 1, limit: filters.limit ?? 50 };
      }
      filters.teamId = actor.teamId;
    }

    const scopedQuery = resolveGlobalLocationQuery(actor, query);
    const state = scopedQuery.state?.trim();
    const storeId = scopedQuery.storeId?.trim();

    const cityFilter = mergeCityListFilter(actor, scopedQuery.city);

    if (cityFilter.city || cityFilter.cities?.length || state || storeId) {
      const { items: schedules } = await this.scheduleRepo.findMany({
        date,
        city: cityFilter.city,
        cities: cityFilter.cities,
        state: state?.toUpperCase(),
        storeId,
        page: 1,
        limit: 500,
      });
      const scheduleIds = schedules.map((s) => s.id!).filter(Boolean);
      if (scheduleIds.length === 0) {
        return {
          items: [],
          total: 0,
          page: filters.page ?? 1,
          limit: filters.limit ?? 50,
        };
      }
      filters.scheduleIds = scheduleIds;
    }

    const { items: routes, total } = await this.routeRepo.findMany(filters);

    const attachDispatchTeam = shouldAttachDispatchTeamAttribution(actor?.role);

    const scheduleIds = [...new Set(routes.map((r) => r.scheduleId))];
    const schedules = await Promise.all(
      scheduleIds.map((id) => this.scheduleRepo.findById(id))
    );
    const scheduleById = new Map(
      schedules.filter(Boolean).map((s) => [s!.id!, s!])
    );

    const dispatchTeamByCity = attachDispatchTeam
      ? await this.dispatchTeamAttribution.mapForCities(
          schedules.filter(Boolean).map((s) => s!.city)
        )
      : null;

    const storeIds = [
      ...new Set(
        schedules.filter(Boolean).map((s) => s!.storeId)
      ),
    ];
    const stores = await Promise.all(storeIds.map((id) => this.storeRepo.findById(id)));
    const storeById = new Map(
      stores.filter(Boolean).map((s) => [s!.id!, mapStoreToResponse(s!)])
    );

    const data = await Promise.all(
      routes.map(async (route) => {
        const schedule = scheduleById.get(route.scheduleId);
        const store = schedule ? storeById.get(schedule.storeId) ?? null : null;
        const [team, driver] = await Promise.all([
          this.teamRepo.findById(route.teamId),
          route.driverId ? this.userRepo.findById(route.driverId) : null,
        ]);

        return {
          ...mapRouteToResponse(route, {
            teamName: team?.name,
            teamCode: team?.code,
            driverEmail: driver?.email,
            driverName: driver
              ? resolveDisplayName(driver.fullName, driver.email)
              : null,
          }),
          schedule: schedule
            ? {
                id: schedule.id,
                date: formatScheduleDate(schedule.date),
                city: schedule.city,
                state: schedule.state,
                storeId: schedule.storeId,
                createdBy: schedule.createdBy,
                store,
                dispatchTeam: dispatchTeamByCity
                  ? dispatchTeamByCity.get(normalizeCity(schedule.city)) ?? null
                  : null,
              }
            : null,
        };
      })
    );

    if (actor?.role === UserRole.TEAM_LEAD && actor.id) {
      await this.teamLeadAlertService.acknowledgeRoutesForDate(actor.id, date);
    }

    return {
      items: data,
      total,
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
    };
  }
}
