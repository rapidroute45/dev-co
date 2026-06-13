import { IUserRepository } from '../../modules/auth/domain/interfaces/user-repository.interface';
import { UserRole } from '../constants/roles';
import { resolveDisplayName } from '../utils/displayName';
import { normalizeCity } from './cityScope.service';

export type DispatchTeamBrief = {
  id: string;
  email: string;
  fullName: string | null;
  displayName: string;
  assignedCity: string;
  assignedCities: string[];
};

export function shouldAttachDispatchTeamAttribution(role: UserRole | null | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.DISPATCH_MANAGER;
}

export class DispatchTeamAttributionService {
  constructor(private userRepo: IUserRepository) {}

  async findByCity(city: string): Promise<DispatchTeamBrief | null> {
    const user = await this.userRepo.findActiveDispatchTeamByCity(city);
    if (!user?.id) return null;
    const assignedCity = user.assignedCity?.trim() || city.trim();
    const assignedCities = user.assignedCities?.length
      ? user.assignedCities
      : assignedCity
        ? [assignedCity]
        : [city.trim()];
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      displayName: resolveDisplayName(user.fullName, user.email),
      assignedCity,
      assignedCities,
    };
  }

  async mapForCities(cities: string[]): Promise<Map<string, DispatchTeamBrief | null>> {
    const unique = [...new Set(cities.map((c) => c.trim()).filter(Boolean))];
    const entries = await Promise.all(
      unique.map(async (city) => {
        const member = await this.findByCity(city);
        return [normalizeCity(city), member] as const;
      })
    );
    return new Map(entries);
  }
}
