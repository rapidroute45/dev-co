import { UserRole } from '../constants/roles';
import { AppError } from '../errors/app-error';

export type CityActor = {
  role: UserRole | null;
  assignedCity?: string | null;
  assignedCities?: string[] | null;
};

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

export function citiesMatch(a: string, b: string): boolean {
  return normalizeCity(a) === normalizeCity(b);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Cities a dispatch team member may access (legacy single city included). */
export function getActorAssignedCities(actor?: CityActor): string[] {
  if (!actor || actor.role !== UserRole.DISPATCH_TEAM) return [];

  const fromArray = (actor.assignedCities ?? [])
    .map((city) => city?.trim())
    .filter(Boolean) as string[];
  if (fromArray.length > 0) return fromArray;

  const legacy = actor.assignedCity?.trim();
  return legacy ? [legacy] : [];
}

/** @deprecated Use getActorAssignedCities — kept for team-lead dashboard paths. */
export function resolveActorCityFilter(actor?: CityActor): string | undefined {
  const cities = getActorAssignedCities(actor);
  if (cities.length === 0) return undefined;
  if (cities.length === 1) return cities[0];
  throw new AppError(
    'Multiple assigned cities require an explicit city filter or cities scope.',
    400
  );
}

export function enforceActorCity(actor: CityActor | undefined, resourceCity: string): void {
  const cities = getActorAssignedCities(actor);
  if (cities.length === 0) return;
  if (!cities.some((city) => citiesMatch(city, resourceCity))) {
    throw new AppError('You can only access data for your assigned cities.', 403);
  }
}

export type CityListFilter = {
  city?: string;
  cities?: string[];
};

/** Resolve list-query city scope for dispatch team (single or multi city). */
export function mergeCityListFilter(
  actor: CityActor | undefined,
  requestedCity?: string
): CityListFilter {
  const scoped = getActorAssignedCities(actor);
  const requested = requestedCity?.trim();

  if (scoped.length === 0) {
    return requested ? { city: requested } : {};
  }

  if (requested) {
    enforceActorCity(actor, requested);
    return { city: requested };
  }

  if (scoped.length === 1) return { city: scoped[0] };
  return { cities: scoped };
}

/** @deprecated Prefer mergeCityListFilter for list endpoints. */
export function mergeCityFilter(actor: CityActor | undefined, requestedCity?: string): string | undefined {
  const filter = mergeCityListFilter(actor, requestedCity);
  return filter.city;
}

export function applyCityListFilter(
  query: Record<string, unknown>,
  filter: CityListFilter
): void {
  if (filter.city?.trim()) {
    query.city = new RegExp(`^${escapeRegex(filter.city.trim())}$`, 'i');
    return;
  }

  if (filter.cities?.length) {
    query.$or = filter.cities.map((city) => ({
      city: new RegExp(`^${escapeRegex(city.trim())}$`, 'i'),
    }));
  }
}
