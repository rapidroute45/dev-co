import { AppError } from '../../../../shared/errors/app-error';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import type { Store } from '../../../stores/domain/entities/store.entity';
import type {
  RouteStopInput,
  RouteStopRecord,
} from '../../domain/interfaces/route-stop-repository.interface';

export function formatStoreAddress(store: Store): string {
  const parts = [store.address, store.city, store.state].filter(Boolean);
  return parts.join(', ').trim() || store.city;
}

export type StopDetailInput = { name: string; address: string; accessCode?: string };

export function parseStopDetails(raw: unknown): StopDetailInput[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new AppError('stopDetails must be an array.', 400);
  }

  const parsed: StopDetailInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;
    const name = String(item?.name ?? '').trim();
    const address = String(item?.address ?? '').trim();
    const accessCode =
      item?.accessCode != null && String(item.accessCode).trim()
        ? String(item.accessCode).trim()
        : undefined;
    if (!name || !address) {
      throw new AppError(`Stop ${i + 1} requires name and address.`, 400);
    }
    parsed.push({ name, address, accessCode: accessCode || undefined });
  }
  return parsed;
}

export function buildRouteStopsForSave(
  store: Store,
  dropoffs: StopDetailInput[]
): RouteStopInput[] {
  const pickup: RouteStopInput = {
    type: 'pickup',
    sequence: 0,
    name: store.storeName,
    address: formatStoreAddress(store),
  };

  const stops = dropoffs.map((d, index) => ({
    type: 'dropoff' as const,
    sequence: index + 1,
    name: d.name,
    address: d.address,
    accessCode: d.accessCode ?? null,
  }));

  return [pickup, ...stops];
}

function mapStopItem(s: RouteStopRecord | (RouteStopRecord & { id?: string })) {
  return {
    id: s.id,
    sequence: s.sequence,
    type: s.type,
    name: s.name,
    address: s.address,
    status: s.status,
    accessCode: s.accessCode,
    deliveryPhotoUrl: s.deliveryPhotoUrl,
    returnReason: s.returnReason,
    returnReasonCustom: s.returnReasonCustom,
    completedAt: s.completedAt,
    lat: s.lat,
    lng: s.lng,
  };
}

export function mapStopsToResponse(stops: RouteStopRecord[]) {
  const pickupStop = stops.find((s) => s.type === 'pickup') ?? null;
  const dropoffStops = stops
    .filter((s) => s.type === 'dropoff')
    .sort((a, b) => a.sequence - b.sequence);

  const completedDropoffs = dropoffStops.filter(
    (s) => s.status === RouteStopStatus.COMPLETED
  ).length;
  const returnedDropoffs = dropoffStops.filter(
    (s) => s.status === RouteStopStatus.RETURNED
  ).length;

  return {
    pickup: pickupStop
      ? {
          id: pickupStop.id,
          name: pickupStop.name,
          address: pickupStop.address,
          status: pickupStop.status,
        }
      : null,
    dropoffs: dropoffStops.map(mapStopItem),
    progress: {
      totalDropoffs: dropoffStops.length,
      completedDropoffs,
      returnedDropoffs,
      pendingDropoffs:
        dropoffStops.length - completedDropoffs - returnedDropoffs,
    },
  };
}
