import { StoreModel } from '../../../stores/infrastructure/models/store.model';
import { ScheduleModel } from '../../../schedules/infrastructure/models/schedule.model';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { normalizeCity } from '../../../../shared/services/cityScope.service';
import { resolveUserAssignedCities } from '../../../users/application/mappers/userResponse.mapper';

export class ListCitiesUseCase {
  constructor(private userRepo = new UserRepository()) {}

  async execute() {
    const [storeCities, scheduleCities, dispatchTeam] = await Promise.all([
      StoreModel.distinct('city'),
      ScheduleModel.distinct('city'),
      this.userRepo.findMany({ role: UserRole.DISPATCH_TEAM, status: UserStatus.ACTIVE }),
    ]);

    const cityMap = new Map<string, string>();
    for (const raw of [...storeCities, ...scheduleCities]) {
      const label = String(raw ?? '').trim();
      if (!label) continue;
      const key = normalizeCity(label);
      if (!cityMap.has(key)) cityMap.set(key, label);
    }

    const assignedByCity = new Map<string, { userId: string; email: string; fullName: string | null }>();
    for (const member of dispatchTeam) {
      for (const city of resolveUserAssignedCities(member)) {
        if (!member.id) continue;
        assignedByCity.set(normalizeCity(city), {
          userId: member.id,
          email: member.email,
          fullName: member.fullName,
        });
      }
    }

    const cities = [...cityMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, name]) => ({
        name,
        assignedDispatchTeam: assignedByCity.get(key) ?? null,
      }));

    return { cities };
  }
}
