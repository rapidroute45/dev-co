import { UserRole } from '../../../../shared/constants/roles';
import { roleRequiresTeam } from '../../../../shared/constants/roleRequirements';
import { AppError } from '../../../../shared/errors/app-error';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../domain/interfaces/team-repository.interface';

export type TeamAssignmentResult = {
  team: {
    id: string;
    name: string;
    code: string;
    teamLeadId: string | null;
  } | null;
};

export class TeamAssignmentService {
  constructor(
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository
  ) {}

  /**
   * Validates and applies team assignment for driver, team driver, and team lead roles.
   */
  async assignUserToTeam(params: {
    userId: string;
    assignedRole: UserRole;
    teamId?: string;
  }): Promise<TeamAssignmentResult> {
    const { userId, assignedRole, teamId } = params;
    const needsTeam = roleRequiresTeam(assignedRole);

    if (needsTeam && !teamId) {
      const roleLabel =
        assignedRole === UserRole.DRIVER
          ? 'Driver'
          : assignedRole === UserRole.TEAM_LEAD
            ? 'Team lead'
            : 'This role';
      throw new AppError(
        `${roleLabel} must be assigned to a team. Select a team (e.g. ABC) before saving.`,
        400
      );
    }

    if (!needsTeam && teamId) {
      throw new AppError('This role does not require a team assignment.', 400);
    }

    if (!needsTeam || !teamId) {
      return { team: null };
    }

    const team = await this.teamRepo.findById(teamId);
    if (!team) {
      throw new AppError('Team not found. Create the team first, then assign the user.', 404);
    }

    if (assignedRole === UserRole.TEAM_LEAD) {
      if (team.teamLeadId && team.teamLeadId !== userId) {
        throw new AppError(
          `Team "${team.name}" already has a team lead. Reassign or choose another team.`,
          409
        );
      }
      await this.teamRepo.setTeamLead(team.id!, userId);
      return {
        team: {
          id: team.id!,
          name: team.name,
          code: team.code,
          teamLeadId: userId,
        },
      };
    }

    // Driver & team driver: link user to team (stored on User.teamId by caller)
    return {
      team: {
        id: team.id!,
        name: team.name,
        code: team.code,
        teamLeadId: team.teamLeadId ?? null,
      },
    };
  }

  async reassignTeam(params: { userId: string; teamId: string }): Promise<TeamAssignmentResult> {
    const user = await this.userRepo.findById(params.userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.role || !roleRequiresTeam(user.role)) {
      throw new AppError('Only drivers, team drivers, and team leads can be assigned to a team.', 400);
    }

    const result = await this.assignUserToTeam({
      userId: params.userId,
      assignedRole: user.role,
      teamId: params.teamId,
    });

    const updated = await this.userRepo.updateTeamId(params.userId, params.teamId);
    if (!updated) {
      throw new AppError('Failed to update team assignment', 500);
    }

    return result;
  }
}
