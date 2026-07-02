import {
  AUTO_COMPLETE_MAX_SPEED_MPS,
  AUTO_COMPLETE_PROXIMITY_RADIUS_M,
  STOP_DWELL_MS,
} from '../constants/driverLocationMonitor.constants';
import {
  computeMedianSpeedMps,
  filterPointsInWindow,
  readRawCoords,
  type BatchMetricPoint,
} from './batchLocationMetrics';
import { haversineMeters } from './haversine';

export type BatchLocationPoint = BatchMetricPoint;

const TICK_GAP_TOLERANCE_MS = 30_000;

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
  proximityM = AUTO_COMPLETE_PROXIMITY_RADIUS_M,
  minDwellMs = STOP_DWELL_MS,
  maxSpeedMps = AUTO_COMPLETE_MAX_SPEED_MPS
): StopDwellMatch | null {
  if (points.length === 0) return null;

  const sorted = [...points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const atStop = sorted
    .map((point) => {
      const { lat, lng } = readRawCoords(point);
      return {
        point,
        recordedAt: point.recordedAt,
        inside: haversineMeters(lat, lng, stopCoords.lat, stopCoords.lng) <= proximityM,
      };
    })
    .filter((entry) => entry.inside);

  if (atStop.length === 0) return null;

  let best: StopDwellMatch | null = null;
  let spanStart = atStop[0]!.recordedAt;
  let spanStartIndex = 0;
  let prev = atStop[0]!.recordedAt;
  let prevIndex = 0;

  const considerSpan = (startIndex: number, endIndex: number, enteredAt: Date, exitedAt: Date) => {
    const dwellMs = exitedAt.getTime() - enteredAt.getTime();
    if (dwellMs < minDwellMs) return;

    const windowPoints = atStop.slice(startIndex, endIndex + 1).map((entry) => entry.point);
    const speedMps = computeMedianSpeedMps(windowPoints, maxSpeedMps);
    if (speedMps >= maxSpeedMps) return;

    const match = { dwellMs, enteredAt, exitedAt };
    if (!best || match.dwellMs > best.dwellMs) {
      best = match;
    }
  };

  for (let i = 1; i < atStop.length; i += 1) {
    const current = atStop[i]!.recordedAt;
    if (current.getTime() - prev.getTime() > TICK_GAP_TOLERANCE_MS) {
      considerSpan(spanStartIndex, prevIndex, spanStart, prev);
      spanStart = current;
      spanStartIndex = i;
    }
    prev = current;
    prevIndex = i;
  }

  considerSpan(spanStartIndex, prevIndex, spanStart, prev);

  return best;
}

/** Points in batch overlapping a dwell window (for realtime auto-complete speed check). */
export function batchPointsForDwellWindow(
  points: BatchLocationPoint[],
  enteredAt: Date,
  endAt: Date
): BatchLocationPoint[] {
  return filterPointsInWindow(points, enteredAt, endAt);
}
