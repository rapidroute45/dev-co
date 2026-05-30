import { IUserRepository } from '../../domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { AppError } from '../../../../shared/errors/app-error';
import { mapUserToResponse } from '../../../users/application/mappers/userResponse.mapper';

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
}

export class UpdateProfileUseCase {
  constructor(
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository
  ) {}

  async execute(userId: string, input: UpdateProfileInput) {
    const updates: { fullName?: string | null; phone?: string | null } = {};

    if (input.fullName !== undefined) {
      const name = input.fullName.trim();
      if (!name) {
        throw new AppError('Full name cannot be empty.', 400);
      }
      updates.fullName = name;
    }

    if (input.phone !== undefined) {
      const phone = input.phone.trim();
      updates.phone = phone || null;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No profile fields provided to update.', 400);
    }

    const updated = await this.userRepo.update(userId, updates);
    if (!updated) {
      throw new AppError('User session invalid or user no longer exists.', 404);
    }

    let team = null;
    if (updated.teamId) {
      const found = await this.teamRepo.findById(updated.teamId);
      if (found) {
        team = {
          id: found.id!,
          name: found.name,
          code: found.code,
          teamLeadId: found.teamLeadId ?? null,
        };
      }
    }

    return mapUserToResponse(updated, team);
  }
}
