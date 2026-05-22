import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../domain/interfaces/team-repository.interface';
import { AppError } from '../../../../shared/errors/app-error';

export class DeleteTeamUseCase {
  constructor(
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(teamId: string) {
    const team = await this.teamRepo.findById(teamId);
    if (!team) throw new AppError('Team not found', 404);

    await this.userRepo.clearTeamFromUsers(teamId);
    const deleted = await this.teamRepo.delete(teamId);
    if (!deleted) throw new AppError('Failed to delete team', 500);

    return {
      success: true,
      message: `Team ${team.name} (${team.code}) deleted. Users were unassigned from this team.`,
    };
  }
}
