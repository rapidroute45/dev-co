/** Max distance (m) from cluster center to count as "same location". */
export const DWELL_RADIUS_METERS = 75;

/** How close the driver must be to the stop destination to start the dwell timer. */
export const STOP_APPROACH_RADIUS_METERS = 250;

/** Dwell measured from the anchor point set when the driver first arrives. */
export const STOP_ANCHOR_RADIUS_METERS = 120;

/** Leave the stop zone (clears dwell) only when farther than this from destination and anchor. */
export const STOP_ZONE_EXIT_METERS = 350;

/**
 * Expected mobile ping interval (documentation; enforced in DispatchMobile).
 * Driver POSTs location every 20s while route is in_progress.
 */
export const LOCATION_PING_INTERVAL_SECONDS = 20;

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
