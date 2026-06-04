const geocodeCache = new Map<string, { lat: number; lng: number }>();

export type GeocodeContext = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

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
  const country = context?.country?.trim();

  if (city && !base.toLowerCase().includes(city.toLowerCase())) {
    push(`${base}, ${city}`);
  }
  if (city && state) {
    push(`${base}, ${city}, ${state}`);
  }
  if (city && state && country) {
    push(`${base}, ${city}, ${state}, ${country}`);
  }

  return variants;
}

export async function geocodeAddress(
  address: string,
  context?: GeocodeContext
): Promise<{ lat: number; lng: number } | null> {
  const variants = buildAddressVariants(address, context);
  if (variants.length === 0) return null;

  for (const variant of variants) {
    const key = variant.toLowerCase();
    const cached = geocodeCache.get(key);
    if (cached) return cached;

    try {
      const q = encodeURIComponent(variant);
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'DispatchApp/1.0 (route-stop-geocode)' },
      });
      if (!res.ok) continue;

      const data = (await res.json()) as { lat?: string; lon?: string }[];
      const first = data?.[0];
      if (!first?.lat || !first?.lon) continue;

      const lat = Number(first.lat);
      const lng = Number(first.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const coords = { lat, lng };
      geocodeCache.set(key, coords);
      return coords;
    } catch {
      /* try next variant */
    }
  }

  return null;
}
