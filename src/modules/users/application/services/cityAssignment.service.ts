import { UserRole } from '../../../../shared/constants/roles';
import { roleRequiresCity } from '../../../../shared/constants/roleRequirements';
import { AppError } from '../../../../shared/errors/app-error';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';

export class CityAssignmentService {
  constructor(private userRepo: IUserRepository) {}

  async validateAndResolveCity(params: {
    userId: string;
    assignedRole: UserRole;
    assignedCity?: string | null;
  }): Promise<string | null> {
    const needsCity = roleRequiresCity(params.assignedRole);

    if (!needsCity) {
      if (params.assignedCity?.trim()) {
        throw new AppError('This role does not require a city assignment.', 400);
      }
      return null;
    }

    const city = params.assignedCity?.trim();
    if (!city) {
      const roleLabel =
        params.assignedRole === UserRole.DISPATCH_TEAM ? 'Dispatch team' : 'Team lead';
      throw new AppError(`${roleLabel} must be assigned to a city.`, 400);
    }

    if (params.assignedRole === UserRole.DISPATCH_TEAM) {
      const taken = await this.userRepo.findActiveDispatchTeamByCity(city);
      if (taken && taken.id !== params.userId) {
        throw new AppError(
          `City "${city}" is already assigned to another dispatch team member.`,
          409
        );
      }
    }

    return city;
  }

  async clearCityIfNotRequired(userId: string, role: UserRole): Promise<void> {
    if (!roleRequiresCity(role)) {
      await this.userRepo.update(userId, { assignedCity: null });
    }
  }
}
