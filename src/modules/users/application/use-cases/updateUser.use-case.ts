import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { TeamAssignmentService } from '../../../teams/application/services/teamAssignment.service';
import { CityAssignmentService } from '../services/cityAssignment.service';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { canAssignRole } from '../../../../shared/constants/assignableRoles';
import { roleRequiresCity, roleRequiresTeam } from '../../../../shared/constants/roleRequirements';
import { AppError } from '../../../../shared/errors/app-error';
import { User } from '../../../auth/domain/entities/user.entity';
import { mapUserToResponse, UserTeamBrief, resolveUserAssignedCities } from '../mappers/userResponse.mapper';
import { parsePhoneInput } from '../../../../shared/utils/phone';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { resolveDisplayName } from '../../../../shared/utils/displayName';

function isOpsManagerActor(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.DISPATCH_MANAGER;
}

function citiesEqual(a: string[], b: string[]): boolean {
  const left = [...a].map((c) => c.trim().toLowerCase()).sort().join('|');
  const right = [...b].map((c) => c.trim().toLowerCase()).sort().join('|');
  return left === right;
}

function buildDispatchTeamUpdateSummary(
  before: User,
  after: User,
  dto: UpdateUserDTO
): string | null {
  const parts: string[] = [];
  const beforeCities = resolveUserAssignedCities(before);
  const afterCities = resolveUserAssignedCities(after);

  if (
    (dto.assignedCity !== undefined || dto.assignedCities !== undefined) &&
    !citiesEqual(beforeCities, afterCities)
  ) {
    parts.push(`Cities updated to ${afterCities.join(', ') || 'none'}`);
  }
  if (dto.fullName !== undefined && (before.fullName ?? '') !== (after.fullName ?? '')) {
    parts.push('Name updated');
  }
  if (dto.phone !== undefined && (before.phone ?? '') !== (after.phone ?? '')) {
    parts.push('Phone updated');
  }
  if (dto.status !== undefined && before.status !== after.status) {
    parts.push(`Status changed to ${after.status}`);
  }
  if (dto.role !== undefined && before.role !== after.role) {
    parts.push(`Role changed to ${after.role}`);
  }
  if (dto.password) {
    parts.push('Password reset');
  }

  return parts.length > 0 ? `${parts.join('. ')}.` : null;
}

export interface UpdateUserDTO {
  fullName?: string | null;
  phone?: string | null;
  role?: UserRole;
  status?: UserStatus;
  teamId?: string | null;
  assignedCity?: string | null;
  assignedCities?: string[] | null;
  password?: string;
}

export class UpdateUserUseCase {
  private teamAssignment: TeamAssignmentService;
  private cityAssignment: CityAssignmentService;

  constructor(
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository,
    private notificationService: NotificationService
  ) {
    this.teamAssignment = new TeamAssignmentService(userRepo, teamRepo);
    this.cityAssignment = new CityAssignmentService(userRepo);
  }

  private async maybeNotifyDispatchTeamUpdated(
    before: User,
    after: User,
    dto: UpdateUserDTO,
    actorRole: UserRole,
    actorUserId?: string
  ): Promise<void> {
    if (!isOpsManagerActor(actorRole) || !actorUserId) return;
    if (after.role !== UserRole.DISPATCH_TEAM || !after.id) return;

    const summary = buildDispatchTeamUpdateSummary(before, after, dto);
    if (!summary) return;

    const actorUser = await this.userRepo.findById(actorUserId);
    const actorName = resolveDisplayName(actorUser?.fullName, actorUser?.email ?? 'Dispatch');

    await this.notificationService.notifyDispatchTeamUpdated({
      recipientId: after.id,
      userId: after.id,
      actorName,
      summary,
    });
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

  private async resolveCityAssignment(
    userId: string,
    role: UserRole,
    user: { assignedCity: string | null; assignedCities: string[] },
    dto: UpdateUserDTO
  ) {
    if (!roleRequiresCity(role)) return undefined;

    const hasCityPatch = dto.assignedCity !== undefined || dto.assignedCities !== undefined;
    if (!hasCityPatch) return undefined;

    return this.cityAssignment.validateAndResolveCityAssignment({
      userId,
      assignedRole: role,
      assignedCity: dto.assignedCity !== undefined ? dto.assignedCity : user.assignedCity,
      assignedCities:
        dto.assignedCities !== undefined ? dto.assignedCities : user.assignedCities,
    });
  }

  async execute(userId: string, dto: UpdateUserDTO, actorRole: UserRole, actorUserId?: string) {
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
    const phonePatch =
      dto.phone !== undefined
        ? parsePhoneInput(dto.phone, { required: false })
        : undefined;

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
      const cityAssignment = await this.resolveCityAssignment(userId, nextRole, user, dto);

      const updated = await this.userRepo.update(userId, {
        fullName: dto.fullName,
        phone: phonePatch,
        role: nextRole,
        status: nextStatus,
        teamId: resolvedTeamId,
        ...(roleRequiresCity(nextRole)
          ? {
              assignedCity: cityAssignment?.assignedCity,
              assignedCities: cityAssignment?.assignedCities,
            }
          : { assignedCity: null, assignedCities: null }),
        passwordHash,
      });

      if (!updated) throw new AppError('Failed to update user', 500);
      await this.maybeNotifyDispatchTeamUpdated(user, updated, dto, actorRole, actorUserId);
      return mapUserToResponse(updated, team);
    }

    if (dto.teamId !== undefined && user.role && roleRequiresTeam(user.role)) {
      const { team } = await this.teamAssignment.reassignTeam({
        userId,
        teamId: dto.teamId!,
      });
      const cityAssignment = await this.resolveCityAssignment(userId, user.role, user, dto);
      const updated = await this.userRepo.update(userId, {
        fullName: dto.fullName,
        phone: phonePatch,
        status: nextStatus,
        assignedCity: cityAssignment?.assignedCity,
        assignedCities: cityAssignment?.assignedCities,
        passwordHash,
      });
      if (!updated) throw new AppError('Failed to update user', 500);
      await this.maybeNotifyDispatchTeamUpdated(user, updated, dto, actorRole, actorUserId);
      return mapUserToResponse(updated, team);
    }

    const cityAssignment =
      user.role && roleRequiresCity(user.role)
        ? await this.resolveCityAssignment(userId, user.role, user, dto)
        : undefined;

    const updated = await this.userRepo.update(userId, {
      fullName: dto.fullName,
      phone: phonePatch,
      status: nextStatus,
      assignedCity: cityAssignment?.assignedCity,
      assignedCities: cityAssignment?.assignedCities,
      passwordHash,
    });

    if (!updated) throw new AppError('Failed to update user', 500);
    await this.maybeNotifyDispatchTeamUpdated(user, updated, dto, actorRole, actorUserId);
    return mapUserToResponse(updated, await this.loadTeamBrief(updated.teamId));
  }
}
