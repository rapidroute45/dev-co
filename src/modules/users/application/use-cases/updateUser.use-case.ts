import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { TeamAssignmentService } from '../../../teams/application/services/teamAssignment.service';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { canAssignRole } from '../../../../shared/constants/assignableRoles';
import { roleRequiresTeam } from '../../../../shared/constants/roleRequirements';
import { AppError } from '../../../../shared/errors/app-error';
import { mapUserToResponse, UserTeamBrief } from '../mappers/userResponse.mapper';

export interface UpdateUserDTO {
  fullName?: string | null;
  role?: UserRole;
  status?: UserStatus;
  teamId?: string | null;
  password?: string;
}

export class UpdateUserUseCase {
  private teamAssignment: TeamAssignmentService;

  constructor(
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository
  ) {
    this.teamAssignment = new TeamAssignmentService(userRepo, teamRepo);
  }

  private async loadTeamBrief(teamId: string | null): Promise<UserTeamBrief> {
    if (!teamId) return null;
    const t = await this.teamRepo.findById(teamId);
    if (!t) return null;
    return {
      id: t.id!,
      name: t.name,
      code: t.code,
      teamLeadId: t.teamLeadId ?? null,
    };
  }

  async execute(userId: string, dto: UpdateUserDTO, actorRole: UserRole) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const nextRole = dto.role !== undefined ? dto.role : user.role;
    const nextStatus = dto.status ?? user.status;

    if (dto.role && !canAssignRole(actorRole, dto.role)) {
      throw new AppError('You are not allowed to assign this role.', 403);
    }

    if (!nextRole && nextStatus === UserStatus.ACTIVE) {
      throw new AppError('Assign a role before activating the user.', 400);
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    if (nextRole) {
      const roleChanged = dto.role !== undefined && dto.role !== user.role;
      let teamIdForAssign: string | undefined;

      if (dto.teamId !== undefined) {
        teamIdForAssign = dto.teamId ?? undefined;
      } else if (roleChanged) {
        teamIdForAssign = roleRequiresTeam(nextRole)
          ? (user.teamId ?? undefined)
          : undefined;
      } else {
        teamIdForAssign = user.teamId ?? undefined;
      }

      const { team } = await this.teamAssignment.assignUserToTeam({
        userId,
        assignedRole: nextRole,
        teamId: teamIdForAssign,
      });

      const resolvedTeamId = roleRequiresTeam(nextRole) ? (team?.id ?? null) : null;

      const updated = await this.userRepo.update(userId, {
        fullName: dto.fullName,
        role: nextRole,
        status: nextStatus,
        teamId: resolvedTeamId,
        passwordHash,
      });

      if (!updated) throw new AppError('Failed to update user', 500);
      return mapUserToResponse(updated, team);
    }

    if (dto.teamId !== undefined && user.role && roleRequiresTeam(user.role)) {
      const { team } = await this.teamAssignment.reassignTeam({
        userId,
        teamId: dto.teamId!,
      });
      const updated = await this.userRepo.update(userId, {
        fullName: dto.fullName,
        status: nextStatus,
        passwordHash,
      });
      if (!updated) throw new AppError('Failed to update user', 500);
      return mapUserToResponse(updated, team);
    }

    const updated = await this.userRepo.update(userId, {
      fullName: dto.fullName,
      status: nextStatus,
      passwordHash,
    });

    if (!updated) throw new AppError('Failed to update user', 500);
    return mapUserToResponse(updated, await this.loadTeamBrief(updated.teamId));
  }
}
