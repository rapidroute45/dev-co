/** Manual / legacy stop proximity (mobile uses 100m). */
export const STOP_PROXIMITY_RADIUS_M = 100;

/** Backend auto-complete geofence radius. */
export const AUTO_COMPLETE_PROXIMITY_RADIUS_M = 50;

/** Snap raw GPS to planned segment when within this distance (m). */
export const ROUTE_SNAP_RADIUS_M = 40;

/** Distance beyond grey segment that counts as off-route (m). */
export const OFF_ROUTE_THRESHOLD_M = 50;

/** Consecutive off-route ticks before reroute (mobile). */
export const OFF_ROUTE_CONSECUTIVE_TICKS = 3;

/** Time at stop before auto-complete. */
export const STOP_DWELL_MS = 2 * 60 * 1000;

/** Max speed (m/s) to count as stopped for auto-complete (~3.6 km/h). */
export const AUTO_COMPLETE_MAX_SPEED_MPS = 1;

/** Movement beyond this radius resets stationary tracking. */
export const STATIONARY_RADIUS_M = 80;

/** Time outside any stop before dispatch stationary alert. */
export const STATIONARY_DWELL_MS = 3 * 60 * 1000;

export const STATIONARY_DWELL_MINUTES = STATIONARY_DWELL_MS / 60_000;

/** No location batch received for this long while route is in progress. */
export const STALE_LOCATION_THRESHOLD_MS = 2 * 60 * 1000;

/** Background scan interval for stale driver locations. */
export const STALE_LOCATION_CHECK_INTERVAL_MS = 60 * 1000;
