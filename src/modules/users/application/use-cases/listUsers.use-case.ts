import { IUserRepository, UserListFilters } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { mapUserToResponse } from '../mappers/userResponse.mapper';

export class ListUsersUseCase {
  constructor(
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository
  ) {}

  async execute(query: {
    status?: string;
    role?: string;
    teamId?: string;
    search?: string;
    pending?: string;
  }) {
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

    const users = await this.userRepo.findMany(filters);

    return Promise.all(
      users.map(async (user) => {
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
