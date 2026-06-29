import type { RouteStopInput } from '../../domain/interfaces/route-stop-repository.interface';
import type { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import type { Store } from '../../../stores/domain/entities/store.entity';
import {
  formatStoreAddress,
  type StopDetailInput,
} from '../utils/routeStops';
import {
  geocodeAddress,
  type GeocodeContext,
} from '../utils/geocodeAddress';
import {
  readStopDestinationCoords,
  STOP_COORD_DRIFT_THRESHOLD_M,
} from '../utils/stopDestinationCoords';
import { haversineMeters } from '../utils/haversine';
import { hasGoogleMapsApiKey } from '../../../../shared/constants/googleMaps';

/** Above this count, skip blocking geocode calls during save. */
export const BULK_STOP_GEOCODE_THRESHOLD = 5;

const NOMINATIM_MIN_INTERVAL_MS = 1100;
let lastGeocodeRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function coordsFromInput(input: StopDetailInput): { lat: number | null; lng: number | null } {
  if (
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    return { lat: input.lat, lng: input.lng };
  }
  return { lat: null, lng: null };
}

async function rateLimitedGeocode(address: string, context: GeocodeContext) {
  if (hasGoogleMapsApiKey()) {
    return geocodeAddress(address, context);
  }
  const waitMs = Math.max(0, lastGeocodeRequestAt + NOMINATIM_MIN_INTERVAL_MS - Date.now());
  if (waitMs > 0) await sleep(waitMs);
  lastGeocodeRequestAt = Date.now();
  return geocodeAddress(address, context);
}

async function resolveCoordinates(
  input: StopDetailInput,
  context: GeocodeContext,
  skipExternalGeocoding: boolean
): Promise<{ lat: number | null; lng: number | null }> {
  const fromInput = coordsFromInput(input);
  if (fromInput.lat != null && fromInput.lng != null) return fromInput;
  if (skipExternalGeocoding) return { lat: null, lng: null };

  const geo = await rateLimitedGeocode(input.address, context);
  if (geo) return { lat: geo.lat, lng: geo.lng };
  return { lat: null, lng: null };
}

export function shouldDeferStopGeocoding(dropoffCount: number): boolean {
  return dropoffCount > BULK_STOP_GEOCODE_THRESHOLD;
}

export async function buildGeocodedRouteStops(params: {
  store: Store;
  pickup?: StopDetailInput | null;
  dropoffs: StopDetailInput[];
  geocodeContext: GeocodeContext;
  skipExternalGeocoding?: boolean;
}): Promise<RouteStopInput[]> {
  const { store, dropoffs, geocodeContext } = params;
  const skipExternalGeocoding = params.skipExternalGeocoding ?? false;

  const pickupInput: StopDetailInput =
    params.pickup?.name && params.pickup?.address
      ? params.pickup
      : {
          name: store.storeName,
          address: formatStoreAddress(store),
        };

  const pickupGeo = await resolveCoordinates(pickupInput, geocodeContext, skipExternalGeocoding);
  const pickup: RouteStopInput = {
    type: 'pickup',
    sequence: 0,
    name: pickupInput.name.trim(),
    address: pickupInput.address.trim(),
    destinationLat: pickupGeo.lat,
    destinationLng: pickupGeo.lng,
    placeId: pickupInput.placeId?.trim() || null,
  };

  const stops: RouteStopInput[] = [];
  for (let i = 0; i < dropoffs.length; i++) {
    const dropoff = dropoffs[i];
    const geo = await resolveCoordinates(dropoff, geocodeContext, skipExternalGeocoding);
    stops.push({
      type: 'dropoff',
      sequence: i + 1,
      name: dropoff.name.trim(),
      address: dropoff.address.trim(),
      accessCode: dropoff.accessCode ?? null,
      destinationLat: geo.lat,
      destinationLng: geo.lng,
      placeId: dropoff.placeId?.trim() || null,
      existingStopId: dropoff.id?.trim() || null,
    });
  }

  return [pickup, ...stops];
}

/** Fill missing or drifted stop coordinates after save or before map routing. */
export async function geocodeMissingRouteStops(params: {
  routeStopRepo: IRouteStopRepository;
  routeId: string;
  geocodeContext: GeocodeContext;
}): Promise<boolean> {
  const { routeStopRepo, routeId, geocodeContext } = params;
  const stops = await routeStopRepo.findByRouteId(routeId);
  let updated = false;

  for (const stop of stops) {
    if (!stop.id || !stop.address.trim()) continue;

    const geo = await rateLimitedGeocode(stop.address, geocodeContext);
    if (!geo) continue;

    const stored = readStopDestinationCoords(stop);
    if (!stored) {
      await routeStopRepo.updateById(stop.id, {
        destinationLat: geo.lat,
        destinationLng: geo.lng,
      });
      updated = true;
      continue;
    }

    const driftM = haversineMeters(stored.lat, stored.lng, geo.lat, geo.lng);
    if (driftM > STOP_COORD_DRIFT_THRESHOLD_M) {
      await routeStopRepo.updateById(stop.id, {
        destinationLat: geo.lat,
        destinationLng: geo.lng,
      });
      updated = true;
    }
  }

  return updated;
}

export function scheduleRouteStopGeocoding(params: {
  routeStopRepo: IRouteStopRepository;
  routeId: string;
  geocodeContext: GeocodeContext;
}) {
  void geocodeMissingRouteStops(params).catch((error) => {
    console.error(`Background geocoding failed for route ${params.routeId}`, error);
  });
}
