import { IUserRepository } from '../../domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { TeamAssignmentService } from '../../../teams/application/services/teamAssignment.service';
import { AppError } from '../../../../shared/errors/app-error';

export interface AssignUserTeamDTO {
  userId: string;
  teamId: string;
}

/** Reassign an active driver / team driver / team lead to another team. */
export class AssignUserTeamUseCase {
  private teamAssignment: TeamAssignmentService;

  constructor(
    private userRepo: IUserRepository,
    teamRepo: ITeamRepository
  ) {
    this.teamAssignment = new TeamAssignmentService(userRepo, teamRepo);
  }

  async execute(dto: AssignUserTeamDTO) {
    const result = await this.teamAssignment.reassignTeam({
      userId: dto.userId,
      teamId: dto.teamId,
    });

    const user = await this.userRepo.findById(dto.userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      teamId: user.teamId,
      team: result.team,
      message: result.team
        ? `User assigned to team ${result.team.name} (${result.team.code}).`
        : undefined,
    };
  }
}
