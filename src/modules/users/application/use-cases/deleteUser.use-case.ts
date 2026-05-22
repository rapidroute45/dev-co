import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { AppError } from '../../../../shared/errors/app-error';

export class DeleteUserUseCase {
  constructor(
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository
  ) {}

  async execute(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const teams = await this.teamRepo.findAll();
    for (const team of teams) {
      if (team.teamLeadId === userId) {
        await this.teamRepo.setTeamLead(team.id!, null);
      }
    }

    const deleted = await this.userRepo.delete(userId);
    if (!deleted) throw new AppError('Failed to delete user', 500);

    return { success: true, message: 'User deleted successfully.' };
  }
}
