/** Driver within this radius of a stop counts as "at stop". */
export const STOP_PROXIMITY_RADIUS_M = 100;

/** Time at stop before auto-complete. */
export const STOP_DWELL_MS = 2 * 60 * 1000;

/** Movement beyond this radius resets stationary tracking. */
export const STATIONARY_RADIUS_M = 80;

/** Time at same spot before dispatch alert. */
export const STATIONARY_DWELL_MS = 2 * 60 * 1000;

export const STATIONARY_DWELL_MINUTES = STATIONARY_DWELL_MS / 60_000;
