/** Max distance (m) from cluster center to count as "same location". */
export const DWELL_RADIUS_METERS = 75;

/**
 * Minutes stationary before in-app dwell notification.
 * Testing: 2. Production: set DWELL_THRESHOLD_MINUTES=20 in .env (or change default below).
 */
export const DWELL_THRESHOLD_MINUTES =
  process.env.DWELL_THRESHOLD_MINUTES != null &&
  process.env.DWELL_THRESHOLD_MINUTES !== ''
    ? Math.max(1, Number(process.env.DWELL_THRESHOLD_MINUTES))
    : 2;

export const DWELL_THRESHOLD_MS = DWELL_THRESHOLD_MINUTES * 60 * 1000;
