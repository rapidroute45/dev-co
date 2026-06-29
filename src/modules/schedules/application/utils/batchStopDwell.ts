import { haversineMeters } from './haversine';
import { STOP_DWELL_MS, STOP_PROXIMITY_RADIUS_M } from '../constants/driverLocationMonitor.constants';

export type BatchLocationPoint = {
  lat: number;
  lng: number;
  rawLat?: number;
  rawLng?: number;
  recordedAt: Date;
};

const TICK_GAP_TOLERANCE_MS = 30_000;

function readPointCoords(point: BatchLocationPoint) {
  const lat = point.rawLat ?? point.lat;
  const lng = point.rawLng ?? point.lng;
  return { lat, lng };
}

export type StopDwellMatch = {
  dwellMs: number;
  enteredAt: Date;
  exitedAt: Date;
};

/**
 * Longest continuous in-geofence span from a location batch (uses raw coords when present).
 */
export function findStopDwellFromBatch(
  points: BatchLocationPoint[],
  stopCoords: { lat: number; lng: number },
  proximityM = STOP_PROXIMITY_RADIUS_M,
  minDwellMs = STOP_DWELL_MS
): StopDwellMatch | null {
  if (points.length === 0) return null;

  const sorted = [...points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const atStop = sorted
    .map((point) => {
      const { lat, lng } = readPointCoords(point);
      return {
        recordedAt: point.recordedAt,
        inside: haversineMeters(lat, lng, stopCoords.lat, stopCoords.lng) <= proximityM,
      };
    })
    .filter((entry) => entry.inside);

  if (atStop.length === 0) return null;

  let best: StopDwellMatch | null = null;
  let spanStart = atStop[0]!.recordedAt;
  let prev = atStop[0]!.recordedAt;

  for (let i = 1; i < atStop.length; i += 1) {
    const current = atStop[i]!.recordedAt;
    if (current.getTime() - prev.getTime() > TICK_GAP_TOLERANCE_MS) {
      const dwellMs = prev.getTime() - spanStart.getTime();
      if (dwellMs >= minDwellMs) {
        best = { dwellMs, enteredAt: spanStart, exitedAt: prev };
      }
      spanStart = current;
    }
    prev = current;
  }

  const finalDwellMs = prev.getTime() - spanStart.getTime();
  if (finalDwellMs >= minDwellMs) {
    const match = { dwellMs: finalDwellMs, enteredAt: spanStart, exitedAt: prev };
    if (!best || match.dwellMs > best.dwellMs) {
      best = match;
    }
  }

  return best;
}
