const geocodeCache = new Map<string, { lat: number; lng: number }>();

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const key = address.trim().toLowerCase();
  if (!key) return null;

  const cached = geocodeCache.get(key);
  if (cached) return cached;

  try {
    const q = encodeURIComponent(address.trim());
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DispatchApp/1.0 (route-stop-geocode)' },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const first = data?.[0];
    if (!first?.lat || !first?.lon) return null;

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const coords = { lat, lng };
    geocodeCache.set(key, coords);
    return coords;
  } catch {
    return null;
  }
}
