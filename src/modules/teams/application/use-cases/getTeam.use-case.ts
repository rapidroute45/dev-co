import { AppError } from '../../../../shared/errors/app-error';
import { ITeamRepository } from '../../domain/interfaces/team-repository.interface';

export class GetTeamUseCase {
  constructor(private teamRepo: ITeamRepository) {}

  async execute(teamId: string) {
    const team = await this.teamRepo.findById(teamId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    return {
      id: team.id,
      name: team.name,
      code: team.code,
      teamLeadId: team.teamLeadId,
      createdBy: team.createdBy,
      createdAt: team.createdAt,
    };
  }
}
