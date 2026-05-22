import { IUserRepository } from '../../domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { AppError } from '../../../../shared/errors/app-error';
import { mapUserToResponse } from '../../../users/application/mappers/userResponse.mapper';

export class GetCurrentUserUseCase {
  constructor(
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository
  ) {}

  async execute(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User session invalid or user no longer exists.', 404);
    }

    let team = null;
    if (user.teamId) {
      const found = await this.teamRepo.findById(user.teamId);
      if (found) {
        team = {
          id: found.id!,
          name: found.name,
          code: found.code,
          teamLeadId: found.teamLeadId ?? null,
        };
      }
    }

    return mapUserToResponse(user, team);
  }
}
