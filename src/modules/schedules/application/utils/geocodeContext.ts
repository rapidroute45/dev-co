import type { GeocodeContext } from './geocodeAddress';

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

function inferCountryFromAddress(address?: string | null, state?: string | null): string | undefined {
  const addr = address?.trim().toUpperCase() ?? '';
  if (/\b(US|USA|U\.S\.A\.)\b/.test(addr) || addr.endsWith(', US')) {
    return 'US';
  }

  const stateCode = state?.trim().toUpperCase();
  if (stateCode && stateCode.length === 2 && US_STATE_CODES.has(stateCode)) {
    return 'US';
  }

  const fromEnv = process.env.DEFAULT_GEOCODE_COUNTRY?.trim();
  return fromEnv || undefined;
}

export function scheduleGeocodeContext(params: {
  city: string;
  state: string;
  storeAddress?: string | null;
  storeState?: string | null;
}): GeocodeContext {
  return {
    city: params.city,
    state: params.state,
    country: inferCountryFromAddress(params.storeAddress, params.storeState ?? params.state),
  };
}
