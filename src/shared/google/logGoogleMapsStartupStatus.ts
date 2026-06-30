import {
  GOOGLE_MAPS_API_KEY,
  hasGoogleMapsApiKey,
} from '../constants/googleMaps';

type ProbeResult = { ok: boolean; detail: string };

/** Sample path in Lahore for startup probes only. */
const PROBE_ORIGIN = { lat: 31.5204, lng: 74.3587 };
const PROBE_DEST = { lat: 31.521, lng: 74.359 };

async function probeRoadsApi(): Promise<ProbeResult> {
  const path = `${PROBE_ORIGIN.lat},${PROBE_ORIGIN.lng}|${PROBE_DEST.lat},${PROBE_DEST.lng}`;
  const url = new URL('https://roads.googleapis.com/v1/snapToRoads');
  url.searchParams.set('path', path);
  url.searchParams.set('interpolate', 'true');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        detail: `HTTP ${response.status} — ${body.slice(0, 120)}`,
      };
    }

    const data = (await response.json()) as {
      snappedPoints?: unknown[];
      error?: { message?: string; status?: string };
    };

    if (data.error?.message) {
      return { ok: false, detail: data.error.message };
    }

    if (!Array.isArray(data.snappedPoints) || data.snappedPoints.length < 2) {
      return { ok: false, detail: 'No snapped points returned' };
    }

    return { ok: true, detail: 'OK' };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

async function probeDirectionsApi(): Promise<ProbeResult> {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${PROBE_ORIGIN.lat},${PROBE_ORIGIN.lng}`);
  url.searchParams.set('destination', `${PROBE_DEST.lat},${PROBE_DEST.lng}`);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return { ok: false, detail: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      status?: string;
      error_message?: string;
    };

    if (data.status === 'OK') {
      return { ok: true, detail: 'OK' };
    }

    return {
      ok: false,
      detail: data.error_message ?? data.status ?? 'Unknown error',
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

/** Log Google Maps Platform connectivity at server startup. */
export async function logGoogleMapsStartupStatus(): Promise<void> {
  console.log('[google-maps] ─── maps platform status ───');

  if (!hasGoogleMapsApiKey()) {
    console.log(
      '[google-maps] status: NOT CONFIGURED — set GOOGLE_MAPS_API_KEY on Railway'
    );
    console.log('[google-maps] Driver track road-matching will use OSRM/raw GPS only');
    console.log('[google-maps] ─────────────────────────────');
    return;
  }

  const keyHint = GOOGLE_MAPS_API_KEY.slice(-4);
  console.log(`[google-maps] key: configured (…${keyHint})`);

  const roads = await probeRoadsApi();
  console.log(
    `[google-maps] Roads API (Snap to Roads): ${roads.ok ? 'OK' : `FAILED — ${roads.detail}`}`
  );
  if (!roads.ok) {
    console.log(
      '[google-maps] Fix: enable Roads API + allow it on this key (Google Cloud Console)'
    );
  }

  const directions = await probeDirectionsApi();
  console.log(
    `[google-maps] Directions API: ${directions.ok ? 'OK' : `FAILED — ${directions.detail}`}`
  );

  if (roads.ok && directions.ok) {
    console.log('[google-maps] status: READY — driver track road-matching enabled');
  } else if (roads.ok) {
    console.log('[google-maps] status: PARTIAL — road-matching OK; reroute may fail');
  } else if (directions.ok) {
    console.log('[google-maps] status: DEGRADED — reroute OK; track will fall back to OSRM/raw GPS');
  } else {
    console.log('[google-maps] status: NOT CONNECTED — check key, billing, and API restrictions');
  }

  console.log('[google-maps] ─────────────────────────────');
}
