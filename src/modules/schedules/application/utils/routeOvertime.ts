/** Planned shift length from scheduled arrival → departure (same calendar day). */
export function plannedRouteHours(arrivalMinutes: number, departureMinutes: number): number {
  const minutes = Math.max(0, departureMinutes - arrivalMinutes);
  return Math.round((minutes / 60) * 100) / 100;
}

/** Overtime = actual worked hours minus planned route window. */
export function computeOvertimeHours(params: {
  arrivalMinutes: number;
  departureMinutes: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
}): number {
  const planned = plannedRouteHours(params.arrivalMinutes, params.departureMinutes);
  if (!params.startedAt || !params.completedAt) return 0;
  const actualMs = params.completedAt.getTime() - params.startedAt.getTime();
  if (actualMs <= 0) return 0;
  const actualHours = actualMs / (1000 * 60 * 60);
  const ot = actualHours - planned;
  return ot > 0 ? Math.round(ot * 100) / 100 : 0;
}
