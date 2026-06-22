import { StoreModel } from '../../../stores/infrastructure/models/store.model';
import { ScheduleModel } from '../../../schedules/infrastructure/models/schedule.model';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { normalizeCity } from '../../../../shared/services/cityScope.service';
import { resolveUserAssignedCities } from '../../../users/application/mappers/userResponse.mapper';

type LocationPair = { city: string; state: string };

function locationPairKey(city: string, state: string): string {
  return `${normalizeCity(city)}|${state.trim().toUpperCase()}`;
}

export class ListCitiesUseCase {
  constructor(private userRepo = new UserRepository()) {}

  async execute() {
    const [storePairs, schedulePairs, dispatchTeam] = await Promise.all([
      StoreModel.aggregate<{ _id: { city: string; state: string } }>([
        { $match: { city: { $nin: [null, ''] }, state: { $nin: [null, ''] } } },
        { $group: { _id: { city: '$city', state: '$state' } } },
      ]),
      ScheduleModel.aggregate<{ _id: { city: string; state: string } }>([
        { $match: { city: { $nin: [null, ''] }, state: { $nin: [null, ''] } } },
        { $group: { _id: { city: '$city', state: '$state' } } },
      ]),
      this.userRepo.findMany({ role: UserRole.DISPATCH_TEAM, status: UserStatus.ACTIVE }),
    ]);

    const locationMap = new Map<string, LocationPair>();
    for (const doc of [...storePairs, ...schedulePairs]) {
      const city = String(doc._id.city ?? '').trim();
      const state = String(doc._id.state ?? '').trim().toUpperCase();
      if (!city || !state) continue;
      const key = locationPairKey(city, state);
      if (!locationMap.has(key)) locationMap.set(key, { city, state });
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

    const locations = [...locationMap.values()]
      .sort((a, b) => {
        const stateCmp = a.state.localeCompare(b.state);
        return stateCmp !== 0 ? stateCmp : a.city.localeCompare(b.city);
      })
      .map(({ city, state }) => ({
        city,
        state,
        assignedDispatchTeam: assignedByCity.get(normalizeCity(city)) ?? null,
      }));

    const states = [...new Set(locations.map((loc) => loc.state))].sort((a, b) => a.localeCompare(b));

    const cityNameByKey = new Map<string, string>();
    for (const { city } of locations) {
      const key = normalizeCity(city);
      if (!cityNameByKey.has(key)) cityNameByKey.set(key, city);
    }

    const cities = [...cityNameByKey.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, name]) => {
        const stateForCity = locations.find((loc) => normalizeCity(loc.city) === key)?.state;
        return {
          name,
          state: stateForCity,
          assignedDispatchTeam: assignedByCity.get(key) ?? null,
        };
      });

    return { states, locations, cities };
  }
}
