/** Google Maps Platform key — env override for production; default for local dev. */
export const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  'AIzaSyAPSxWJWEAZ7Fq3nov9TuT3MWG9JEInKEQ';

export function hasGoogleMapsApiKey(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY);
}
