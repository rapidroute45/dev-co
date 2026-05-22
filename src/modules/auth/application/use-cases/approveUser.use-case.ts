import { IUserRepository } from '../../domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { TeamAssignmentService } from '../../../teams/application/services/teamAssignment.service';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { AppError } from '../../../../shared/errors/app-error';

export interface ApproveUserDTO {
  userId: string;
  assignedRole: UserRole;
  teamId?: string;
}

export class ApproveUserUseCase {
  private teamAssignment: TeamAssignmentService;

  constructor(
    private userRepo: IUserRepository,
    teamRepo: ITeamRepository
  ) {
    this.teamAssignment = new TeamAssignmentService(userRepo, teamRepo);
  }

  async execute(dto: ApproveUserDTO) {
    const user = await this.userRepo.findById(dto.userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!Object.values(UserRole).includes(dto.assignedRole)) {
      throw new AppError('Invalid role assignment.', 400);
    }

    const { team } = await this.teamAssignment.assignUserToTeam({
      userId: dto.userId,
      assignedRole: dto.assignedRole,
      teamId: dto.teamId,
    });

    const updated = await this.userRepo.updateAfterApproval({
      userId: dto.userId,
      role: dto.assignedRole,
      status: UserStatus.ACTIVE,
      teamId: team ? team.id : null,
    });

    if (!updated) {
      throw new AppError('Failed to update user', 500);
    }

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      teamId: updated.teamId,
      team,
      message:
        dto.assignedRole === UserRole.DRIVER && team
          ? `Driver assigned to team ${team.name} (${team.code}).`
          : undefined,
    };
  }
}
