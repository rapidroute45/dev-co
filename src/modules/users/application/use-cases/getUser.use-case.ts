import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { AppError } from '../../../../shared/errors/app-error';
import { mapUserToResponse } from '../mappers/userResponse.mapper';
import { resolveDisplayName } from '../../../../shared/utils/displayName';

export class GetUserUseCase {
  constructor(
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository
  ) {}

  async execute(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError('User not found', 404);

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
  }
}
