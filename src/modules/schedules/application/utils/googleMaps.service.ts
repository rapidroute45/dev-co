export type GeocodeContext = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

function apiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

function buildAddressVariants(address: string, context?: GeocodeContext): string[] {
  const base = address.trim();
  if (!base) return [];

  const seen = new Set<string>();
  const variants: string[] = [];
  const push = (v: string) => {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    variants.push(v.trim());
  };

  push(base);
  const city = context?.city?.trim();
  const state = context?.state?.trim();
  const country = context?.country?.trim() ?? 'Pakistan';

  if (city && !base.toLowerCase().includes(city.toLowerCase())) {
    push(`${base}, ${city}`);
  }
  if (city && state) push(`${base}, ${city}, ${state}`);
  if (city && state && country) push(`${base}, ${city}, ${state}, ${country}`);

  return variants;
}

export async function googleGeocodeAddress(
  address: string,
  context?: GeocodeContext
): Promise<{ lat: number; lng: number } | null> {
  const key = apiKey();
  if (!key) return null;

  for (const variant of buildAddressVariants(address, context)) {
    try {
      const q = encodeURIComponent(variant);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const data = (await res.json()) as {
        status?: string;
        results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
      };
      if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) continue;

      const lat = Number(data.results[0].geometry.location.lat);
      const lng = Number(data.results[0].geometry.location.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      return { lat, lng };
    } catch {
      /* try next variant */
    }
  }

  return null;
}

export async function googlePlaceDetails(
  placeId: string
): Promise<{ lat: number; lng: number; formattedAddress: string; name?: string } | null> {
  const key = apiKey();
  if (!key || !placeId.trim()) return null;

  try {
    const pid = encodeURIComponent(placeId.trim());
    const fields = encodeURIComponent('geometry,formatted_address,name,place_id');
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pid}&fields=${fields}&key=${key}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status?: string;
      result?: {
        formatted_address?: string;
        name?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      };
    };
    if (data.status !== 'OK' || !data.result?.geometry?.location) return null;

    const lat = Number(data.result.geometry.location.lat);
    const lng = Number(data.result.geometry.location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      lat,
      lng,
      formattedAddress: data.result.formatted_address?.trim() || '',
      name: data.result.name?.trim(),
    };
  } catch {
    return null;
  }
}
