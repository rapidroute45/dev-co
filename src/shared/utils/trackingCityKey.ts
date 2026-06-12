import { normalizeCity } from '../services/cityScope.service';

export function trackingCityKey(city: string, state?: string | null): string {
  const cityPart = normalizeCity(city);
  const statePart = state?.trim().toLowerCase() ?? '';
  return statePart ? `${cityPart}|${statePart}` : cityPart;
}

export function trackingCityRoom(city: string, state?: string | null): string {
  return `tracking:city:${trackingCityKey(city, state)}`;
}
