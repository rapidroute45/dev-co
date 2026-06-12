import { UserRole } from '../../../../shared/constants/roles';
import { roleRequiresCity } from '../../../../shared/constants/roleRequirements';
import { AppError } from '../../../../shared/errors/app-error';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';

export type CityAssignmentResult = {
  assignedCity: string | null;
  assignedCities: string[] | null;
};

function normalizeCityList(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const raw of values) {
    const city = raw?.trim();
    if (!city) continue;
    const key = city.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cities.push(city);
  }
  return cities;
}

export class CityAssignmentService {
  constructor(private userRepo: IUserRepository) {}

  async validateAndResolveCityAssignment(params: {
    userId: string;
    assignedRole: UserRole;
    assignedCity?: string | null;
    assignedCities?: string[] | null;
  }): Promise<CityAssignmentResult> {
    const needsCity = roleRequiresCity(params.assignedRole);

    if (!needsCity) {
      if (params.assignedCity?.trim() || (params.assignedCities?.length ?? 0) > 0) {
        throw new AppError('This role does not require a city assignment.', 400);
      }
      return { assignedCity: null, assignedCities: null };
    }

    if (params.assignedRole === UserRole.DISPATCH_TEAM) {
      const cities = normalizeCityList([
        ...(params.assignedCities ?? []),
        ...(params.assignedCity ? [params.assignedCity] : []),
      ]);

      if (cities.length === 0) {
        throw new AppError('Dispatch team must be assigned to at least one city.', 400);
      }

      for (const city of cities) {
        const taken = await this.userRepo.findActiveDispatchTeamByCity(city);
        if (taken && taken.id !== params.userId) {
          throw new AppError(
            `City "${city}" is already assigned to another dispatch team member.`,
            409
          );
        }
      }

      return { assignedCity: null, assignedCities: cities };
    }

    throw new AppError('Unsupported role for city assignment.', 400);
  }

  /** @deprecated Use validateAndResolveCityAssignment. */
  async validateAndResolveCity(params: {
    userId: string;
    assignedRole: UserRole;
    assignedCity?: string | null;
    assignedCities?: string[] | null;
  }): Promise<string | null> {
    const result = await this.validateAndResolveCityAssignment(params);
    if (params.assignedRole === UserRole.DISPATCH_TEAM) {
      return result.assignedCities?.[0] ?? null;
    }
    return result.assignedCity;
  }

  async clearCityIfNotRequired(userId: string, role: UserRole): Promise<void> {
    if (!roleRequiresCity(role)) {
      await this.userRepo.update(userId, { assignedCity: null, assignedCities: null });
    }
  }
}
