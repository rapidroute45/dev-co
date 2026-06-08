import { UserRole } from '../constants/roles';
import { AppError } from '../errors/app-error';

export type CityActor = {
  role: UserRole | null;
  assignedCity?: string | null;
};

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

export function citiesMatch(a: string, b: string): boolean {
  return normalizeCity(a) === normalizeCity(b);
}

/** Returns assigned city for dispatch team; undefined = no city restriction. */
export function resolveActorCityFilter(actor?: CityActor): string | undefined {
  if (!actor || actor.role !== UserRole.DISPATCH_TEAM) return undefined;
  const city = actor.assignedCity?.trim();
  if (!city) {
    throw new AppError('Dispatch team account has no assigned city.', 403);
  }
  return city;
}

export function enforceActorCity(actor: CityActor | undefined, resourceCity: string): void {
  const scope = resolveActorCityFilter(actor);
  if (!scope) return;
  if (!citiesMatch(scope, resourceCity)) {
    throw new AppError('You can only access data for your assigned city.', 403);
  }
}

export function mergeCityFilter(actor: CityActor | undefined, requestedCity?: string): string | undefined {
  const scope = resolveActorCityFilter(actor);
  if (scope) return scope;
  return requestedCity?.trim() || undefined;
}
