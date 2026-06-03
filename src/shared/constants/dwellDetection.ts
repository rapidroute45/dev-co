/** Max distance (m) from cluster center to count as "same location". */
export const DWELL_RADIUS_METERS = 75;

/**
 * Expected mobile ping interval (documentation; enforced in DispatchMobile).
 * Driver POSTs location every 30s while route is in_progress.
 */
export const LOCATION_PING_INTERVAL_SECONDS = 30;

/**
 * Minutes at the same location before in-app dwell notification to admin/ops.
 * Default 2 minutes. Production: set DWELL_THRESHOLD_MINUTES=20 in .env.
 */
export const DWELL_THRESHOLD_MINUTES =
  process.env.DWELL_THRESHOLD_MINUTES != null &&
  process.env.DWELL_THRESHOLD_MINUTES !== ''
    ? Math.max(1, Number(process.env.DWELL_THRESHOLD_MINUTES))
    : 2;

export const DWELL_THRESHOLD_MS = DWELL_THRESHOLD_MINUTES * 60 * 1000;
