import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { TeamAssignmentService } from '../../../teams/application/services/teamAssignment.service';
import { CityAssignmentService } from '../services/cityAssignment.service';
import { User } from '../../../auth/domain/entities/user.entity';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { canAssignRole } from '../../../../shared/constants/assignableRoles';
import { AppError } from '../../../../shared/errors/app-error';
import { mapUserToResponse, resolveUserAssignedCities } from '../mappers/userResponse.mapper';
import { parsePhoneInput } from '../../../../shared/utils/phone';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { resolveDisplayName } from '../../../../shared/utils/displayName';

function isOpsManagerActor(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.DISPATCH_MANAGER;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  fullName?: string;
  phone: string;
  role: UserRole;
  teamId?: string;
  assignedCity?: string | null;
  assignedCities?: string[] | null;
  status?: UserStatus;
}

export class CreateUserUseCase {
  private teamAssignment: TeamAssignmentService;
  private cityAssignment: CityAssignmentService;

  constructor(
    private userRepo: IUserRepository,
    teamRepo: ITeamRepository,
    private notificationService: NotificationService
  ) {
    this.teamAssignment = new TeamAssignmentService(userRepo, teamRepo);
    this.cityAssignment = new CityAssignmentService(userRepo);
  }

  async execute(dto: CreateUserDTO, actorRole: UserRole, actorUserId?: string) {
    if (!canAssignRole(actorRole, dto.role)) {
      throw new AppError('You are not allowed to create a user with this role.', 403);
    }

    const email = dto.email?.toLowerCase().trim();
    if (!email) throw new AppError('Email is required.', 400);
    if (await this.userRepo.findByEmail(email)) {
      throw new AppError('Email already in use.', 400);
    }

    if (!dto.password || dto.password.length < 8) {
      throw new AppError('Password must be at least 8 characters.', 400);
    }

    if (!dto.role) {
      throw new AppError('Role is required.', 400);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const status = dto.status ?? UserStatus.ACTIVE;

    const user = new User({
      email,
      passwordHash,
      fullName: dto.fullName?.trim() || null,
      phone: parsePhoneInput(dto.phone, { required: true }),
      role: dto.role,
      status,
      teamId: null,
    });

    const saved = await this.userRepo.save(user);
    const userId = saved.id!;

    const { team } = await this.teamAssignment.assignUserToTeam({
      userId,
      assignedRole: dto.role,
      teamId: dto.teamId,
    });

    const cityAssignment = await this.cityAssignment.validateAndResolveCityAssignment({
      userId,
      assignedRole: dto.role,
      assignedCity: dto.assignedCity,
      assignedCities: dto.assignedCities,
    });

    const updated = await this.userRepo.update(userId, {
      teamId: team?.id ?? null,
      assignedCity: cityAssignment.assignedCity,
      assignedCities: cityAssignment.assignedCities,
      status,
      role: dto.role,
    });

    if (!updated) throw new AppError('Failed to create user', 500);

    if (
      dto.role === UserRole.DISPATCH_TEAM &&
      status === UserStatus.ACTIVE &&
      isOpsManagerActor(actorRole) &&
      actorUserId
    ) {
      const actorUser = await this.userRepo.findById(actorUserId);
      const actorName = resolveDisplayName(actorUser?.fullName, actorUser?.email ?? 'Dispatch');
      const cities = resolveUserAssignedCities(updated);
      await this.notificationService.notifyDispatchTeamUpdated({
        recipientId: userId,
        userId,
        actorName,
        summary: cities.length
          ? `Your account is active. Assigned cities: ${cities.join(', ')}.`
          : 'Your dispatch team account is active.',
      });
    }

    return mapUserToResponse(updated, team);
  }
}
