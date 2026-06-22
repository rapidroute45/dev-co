import { IUserRepository, UserListFilters } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IScheduleRepository } from '../../../schedules/domain/interfaces/schedule-repository.interface';
import { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { mapUserToResponse } from '../mappers/userResponse.mapper';
import { UserLocationScopeService } from '../services/userLocationScope.service';
import { CityActor, canUseGlobalLocationScope, resolveGlobalLocationQuery } from '../../../../shared/services/cityScope.service';

export class ListUsersUseCase {
  private locationScope: UserLocationScopeService;

  constructor(
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository,
    scheduleRepo: IScheduleRepository,
    routeRepo: IRouteRepository
  ) {
    this.locationScope = new UserLocationScopeService(scheduleRepo, routeRepo, userRepo);
  }

  async execute(
    query: {
      status?: string;
      role?: string;
      teamId?: string;
      search?: string;
      pending?: string;
      city?: string;
      state?: string;
    },
    actor?: CityActor
  ) {
    const filters: UserListFilters = {};

    if (query.status && Object.values(UserStatus).includes(query.status as UserStatus)) {
      filters.status = query.status as UserStatus;
    }
    if (query.role && Object.values(UserRole).includes(query.role as UserRole)) {
      filters.role = query.role as UserRole;
    }
    if (query.teamId) filters.teamId = query.teamId;
    if (query.search) filters.search = query.search;
    if (query.pending === 'true') filters.pendingApproval = true;

    const scopedQuery = canUseGlobalLocationScope(actor)
      ? resolveGlobalLocationQuery(actor, query as Record<string, string>)
      : ({} as Record<string, string>);

    const [users, scopeContext] = await Promise.all([
      this.userRepo.findMany(filters),
      canUseGlobalLocationScope(actor)
        ? this.locationScope.buildScopeContext(scopedQuery)
        : Promise.resolve(null),
    ]);

    const scopedUsers = scopeContext
      ? users.filter((user) => this.locationScope.userMatchesScope(user, scopeContext))
      : users;

    return Promise.all(
      scopedUsers.map(async (user) => {
        let team = null;
        if (user.teamId) {
          const t = await this.teamRepo.findById(user.teamId);
          if (t) {
            team = {
              id: t.id!,
              name: t.name,
              code: t.code,
              teamLeadId: t.teamLeadId ?? null,
            };
          }
        }
        return mapUserToResponse(user, team);
      })
    );
  }
}
