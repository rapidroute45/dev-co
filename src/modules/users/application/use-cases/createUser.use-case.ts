import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { TeamAssignmentService } from '../../../teams/application/services/teamAssignment.service';
import { User } from '../../../auth/domain/entities/user.entity';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { canAssignRole } from '../../../../shared/constants/assignableRoles';
import { AppError } from '../../../../shared/errors/app-error';
import { mapUserToResponse } from '../mappers/userResponse.mapper';

export interface CreateUserDTO {
  email: string;
  password: string;
  fullName?: string;
  role: UserRole;
  teamId?: string;
  status?: UserStatus;
}

export class CreateUserUseCase {
  private teamAssignment: TeamAssignmentService;

  constructor(
    private userRepo: IUserRepository,
    teamRepo: ITeamRepository
  ) {
    this.teamAssignment = new TeamAssignmentService(userRepo, teamRepo);
  }

  async execute(dto: CreateUserDTO, actorRole: UserRole) {
    if (!canAssignRole(actorRole, dto.role)) {
      throw new AppError('You are not allowed to create a user with this role.', 403);
    }

    const email = dto.email.toLowerCase().trim();
    if (await this.userRepo.findByEmail(email)) {
      throw new AppError('Email already in use', 400);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const status = dto.status ?? UserStatus.ACTIVE;

    const user = new User({
      email,
      passwordHash,
      fullName: dto.fullName?.trim() || null,
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

    const updated = await this.userRepo.update(userId, {
      teamId: team?.id ?? null,
      status,
      role: dto.role,
    });

    if (!updated) throw new AppError('Failed to create user', 500);

    return mapUserToResponse(updated, team);
  }
}
