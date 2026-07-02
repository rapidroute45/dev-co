import { AUTO_COMPLETE_PROXIMITY_RADIUS_M } from '../constants/driverLocationMonitor.constants';
import { haversineMeters } from './haversine';
import { readStopDestinationCoords } from './stopDestinationCoords';
import type { BatchMetricPoint } from './batchLocationMetrics';
import { readRawCoords } from './batchLocationMetrics';

type StopLike = {
  id?: string | null;
  type?: string | null;
  status?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  lat?: number | null;
  lng?: number | null;
};

export function isNearStopCoords(
  point: BatchMetricPoint,
  stopCoords: { lat: number; lng: number },
  radiusM = AUTO_COMPLETE_PROXIMITY_RADIUS_M
): boolean {
  const raw = readRawCoords(point);
  return haversineMeters(raw.lat, raw.lng, stopCoords.lat, stopCoords.lng) <= radiusM;
}

export function isNearAnyPendingStop(
  point: BatchMetricPoint,
  pendingDropoffs: StopLike[],
  radiusM = AUTO_COMPLETE_PROXIMITY_RADIUS_M
): boolean {
  for (const stop of pendingDropoffs) {
    const dest = readStopDestinationCoords(stop);
    if (!dest) continue;
    if (isNearStopCoords(point, dest, radiusM)) {
      return true;
    }
  }
  return false;
}
