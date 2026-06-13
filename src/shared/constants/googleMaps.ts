/** Google Maps Platform key — set GOOGLE_MAPS_API_KEY in Dev-co/.env */
export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY?.trim() || '';

export function hasGoogleMapsApiKey(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY);
}
