/** Driver within this radius of a stop counts as "at stop". */
export const STOP_PROXIMITY_RADIUS_M = 100;

/** Snap raw GPS to planned segment when within this distance (m). */
export const ROUTE_SNAP_RADIUS_M = 40;

/** Distance beyond grey segment that counts as off-route (m). */
export const OFF_ROUTE_THRESHOLD_M = 50;

/** Consecutive off-route ticks before reroute (mobile). */
export const OFF_ROUTE_CONSECUTIVE_TICKS = 3;

/** Time at stop before auto-complete. */
export const STOP_DWELL_MS = 2 * 60 * 1000;

/** Movement beyond this radius resets stationary tracking. */
export const STATIONARY_RADIUS_M = 80;

/** Time at same spot before dispatch alert. */
export const STATIONARY_DWELL_MS = 2 * 60 * 1000;

export const STATIONARY_DWELL_MINUTES = STATIONARY_DWELL_MS / 60_000;
