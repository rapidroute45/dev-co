import { AppError } from '../../../../shared/errors/app-error';
import type { RouteStopInput } from '../../domain/interfaces/route-stop-repository.interface';
import type { Store } from '../../../stores/domain/entities/store.entity';
import {
  formatStoreAddress,
  type StopDetailInput,
} from '../utils/routeStops';
import {
  googleGeocodeAddress,
  googlePlaceDetails,
  type GeocodeContext,
} from '../utils/googleMaps.service';
import { geocodeAddress as nominatimGeocode } from '../utils/geocodeAddress';

async function resolveCoordinates(
  input: StopDetailInput,
  context: GeocodeContext
): Promise<{ lat: number; lng: number; placeId: string | null }> {
  if (
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    return {
      lat: input.lat,
      lng: input.lng,
      placeId: input.placeId?.trim() || null,
    };
  }

  if (input.placeId?.trim()) {
    const details = await googlePlaceDetails(input.placeId.trim());
    if (details) {
      return {
        lat: details.lat,
        lng: details.lng,
        placeId: input.placeId.trim(),
      };
    }
  }

  let geo = await googleGeocodeAddress(input.address, context);
  if (!geo) {
    geo = await nominatimGeocode(input.address, context);
  }

  if (!geo) {
    throw new AppError(
      `Could not resolve map coordinates for "${input.name}". Pick the address from Google suggestions or check the address.`,
      400
    );
  }

  return {
    lat: geo.lat,
    lng: geo.lng,
    placeId: input.placeId?.trim() || null,
  };
}

export async function buildGeocodedRouteStops(params: {
  store: Store;
  pickup?: StopDetailInput | null;
  dropoffs: StopDetailInput[];
  geocodeContext: GeocodeContext;
}): Promise<RouteStopInput[]> {
  const { store, dropoffs, geocodeContext } = params;

  const pickupInput: StopDetailInput = params.pickup?.name && params.pickup?.address
    ? params.pickup
    : {
        name: store.storeName,
        address: formatStoreAddress(store),
      };

  const pickupGeo = await resolveCoordinates(pickupInput, geocodeContext);
  const pickup: RouteStopInput = {
    type: 'pickup',
    sequence: 0,
    name: pickupInput.name.trim(),
    address: pickupInput.address.trim(),
    destinationLat: pickupGeo.lat,
    destinationLng: pickupGeo.lng,
    placeId: pickupGeo.placeId,
  };

  const stops: RouteStopInput[] = [];
  for (let i = 0; i < dropoffs.length; i++) {
    const d = dropoffs[i];
    const geo = await resolveCoordinates(d, geocodeContext);
    stops.push({
      type: 'dropoff',
      sequence: i + 1,
      name: d.name.trim(),
      address: d.address.trim(),
      accessCode: d.accessCode ?? null,
      destinationLat: geo.lat,
      destinationLng: geo.lng,
      placeId: geo.placeId,
    });
  }

  return [pickup, ...stops];
}
