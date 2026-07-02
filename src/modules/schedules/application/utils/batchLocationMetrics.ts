import { AUTO_COMPLETE_MAX_SPEED_MPS } from '../constants/driverLocationMonitor.constants';
import { haversineMeters } from './haversine';

export type BatchMetricPoint = {
  lat: number;
  lng: number;
  rawLat?: number;
  rawLng?: number;
  recordedAt: Date;
};

export function readRawCoords(point: BatchMetricPoint) {
  return {
    lat: point.rawLat ?? point.lat,
    lng: point.rawLng ?? point.lng,
  };
}

/** Median speed (m/s) across consecutive batch samples. */
export function computeMedianSpeedMps(
  points: BatchMetricPoint[],
  maxSpeedMps = AUTO_COMPLETE_MAX_SPEED_MPS
): number {
  if (points.length < 2) return 0;

  const sorted = [...points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const speeds: number[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = readRawCoords(sorted[i - 1]!);
    const next = readRawCoords(sorted[i]!);
    const dtSec = (sorted[i]!.recordedAt.getTime() - sorted[i - 1]!.recordedAt.getTime()) / 1000;
    if (dtSec <= 0) continue;
    const distanceM = haversineMeters(prev.lat, prev.lng, next.lat, next.lng);
    speeds.push(distanceM / dtSec);
  }

  if (speeds.length === 0) return 0;
  speeds.sort((a, b) => a - b);
  const median = speeds[Math.floor(speeds.length / 2)]!;
  return Math.min(median, maxSpeedMps * 10);
}

export function isStationarySpeed(
  points: BatchMetricPoint[],
  maxSpeedMps = AUTO_COMPLETE_MAX_SPEED_MPS
): boolean {
  return computeMedianSpeedMps(points) < maxSpeedMps;
}

export function filterPointsInWindow(
  points: BatchMetricPoint[],
  startAt: Date,
  endAt: Date
): BatchMetricPoint[] {
  const startMs = startAt.getTime();
  const endMs = endAt.getTime();
  return points.filter((point) => {
    const ms = point.recordedAt.getTime();
    return ms >= startMs && ms <= endMs;
  });
}
