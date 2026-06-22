import { User } from '../../../auth/domain/entities/user.entity';
import { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../../schedules/domain/interfaces/schedule-repository.interface';
import { UserRole } from '../../../../shared/constants/roles';
import { normalizeCity } from '../../../../shared/services/cityScope.service';
import { resolveUserAssignedCities } from '../mappers/userResponse.mapper';
import { DispatchTeamAttributionService } from '../../../../shared/services/dispatchTeamAttribution.service';

const DRIVER_ROLES = [UserRole.DRIVER, UserRole.TEAM_DRIVER, UserRole.TEAM_LEAD];
const MANAGER_ROLES = [UserRole.DISPATCH_MANAGER, UserRole.ADMIN, UserRole.ACCOUNTANT];

export type LocationScopeQuery = {
  city?: string;
  state?: string;
};

export type LocationScopeContext = {
  scopedCityKeys: Set<string>;
  teamIds: Set<string>;
  driverIds: Set<string>;
  dispatchAttributionUserIds: Set<string>;
};

export class UserLocationScopeService {
  private dispatchTeamAttribution: DispatchTeamAttributionService;

  constructor(
    private scheduleRepo: IScheduleRepository,
    private routeRepo: IRouteRepository,
    userRepo: ConstructorParameters<typeof DispatchTeamAttributionService>[0]
  ) {
    this.dispatchTeamAttribution = new DispatchTeamAttributionService(userRepo);
  }

  async buildScopeContext(query: LocationScopeQuery) {
    const city = query.city?.trim();
    const state = query.state?.trim();
    if (!city && !state) return null;

    const { items: schedules } = await this.scheduleRepo.findMany({
      city,
      state,
      page: 1,
      limit: 5000,
    });

    const scheduleIds = schedules.map((s) => s.id!).filter(Boolean);
    const { teamIds, driverIds } =
      await this.routeRepo.findTeamAndDriverIdsByScheduleIds(scheduleIds);

    const scopedCityKeys = new Set<string>();
    for (const schedule of schedules) {
      scopedCityKeys.add(normalizeCity(schedule.city));
    }
    if (city) scopedCityKeys.add(normalizeCity(city));

    const dispatchAttributionUserIds = new Set<string>();
    for (const cityKey of scopedCityKeys) {
      const cityName =
        schedules.find((s) => normalizeCity(s.city) === cityKey)?.city ?? city ?? '';
      if (!cityName) continue;
      const member = await this.dispatchTeamAttribution.findByCity(cityName);
      if (member?.id) dispatchAttributionUserIds.add(member.id);
    }

    return {
      scopedCityKeys,
      teamIds: new Set(teamIds),
      driverIds: new Set(driverIds),
      dispatchAttributionUserIds,
    };
  }

  userMatchesScope(user: User, scope: LocationScopeContext): boolean {
    if (!user.id) return false;

    if (user.role === UserRole.DISPATCH_TEAM) {
      return resolveUserAssignedCities(user).some((assigned) =>
        scope.scopedCityKeys.has(normalizeCity(assigned))
      );
    }

    if (user.role != null && DRIVER_ROLES.includes(user.role)) {
      if (scope.driverIds.has(user.id)) return true;
      if (user.teamId && scope.teamIds.has(user.teamId)) return true;
      return false;
    }

    if (user.role != null && MANAGER_ROLES.includes(user.role)) {
      const assigned = resolveUserAssignedCities(user);
      if (assigned.some((c) => scope.scopedCityKeys.has(normalizeCity(c)))) return true;
      if (scope.dispatchAttributionUserIds.has(user.id)) return true;
      return false;
    }

    if (user.teamId && scope.teamIds.has(user.teamId)) return true;
    if (scope.driverIds.has(user.id)) return true;

    return false;
  }
}
