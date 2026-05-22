import { AppError } from '../../../../shared/errors/app-error';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../domain/interfaces/team-repository.interface';

export class GetTeamMembersUseCase {
  constructor(
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(teamId: string) {
    const team = await this.teamRepo.findById(teamId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    const members = await this.userRepo.findManyByTeamId(teamId);

    return {
      team: {
        id: team.id,
        name: team.name,
        code: team.code,
        teamLeadId: team.teamLeadId,
      },
      members: members.map((m) => ({
        id: m.id,
        email: m.email,
        role: m.role,
        status: m.status,
        isTeamLead: team.teamLeadId === m.id,
      })),
      memberCount: members.length,
    };
  }
}
