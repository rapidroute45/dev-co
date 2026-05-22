export enum RouteStatus {
  /** No driver, or driver selected but offer not yet accepted */
  PENDING = 'pending',
  /** @deprecated Legacy; new offers stay pending until driver accepts */
  ASSIGNED = 'assigned',
  /** Driver accepted the route offer */
  ACTIVE = 'active',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export const ROUTE_STATUSES = Object.values(RouteStatus);

/** Routes that block driver availability for overlap checks */
export const ROUTE_ACTIVE_STATUSES = [
  RouteStatus.PENDING,
  RouteStatus.ASSIGNED,
  RouteStatus.ACTIVE,
  RouteStatus.IN_PROGRESS,
];
