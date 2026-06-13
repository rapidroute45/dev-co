import type { Route } from '../../../schedules/domain/entities/route.entity';
import type { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import type { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import {
  formatScheduleDate,
  maxPayrollPeriodEndDate,
  parseScheduleDate,
} from '../../../schedules/application/utils/scheduleDate';

export async function loadUnbilledCompletedRoutesForTeam(
  routeRepo: IRouteRepository,
  payrollRepo: IPayrollRepository,
  teamId: string
): Promise<Route[]> {
  const billedIds = await payrollRepo.collectAllBilledRouteIds();
  return routeRepo.findCompletedByTeamExcludingRouteIds(teamId, billedIds);
}

export async function loadUnbilledCompletedRoutesForTeamInPeriod(
  routeRepo: IRouteRepository,
  payrollRepo: IPayrollRepository,
  teamId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Route[]> {
  const billedIds = await payrollRepo.collectAllBilledRouteIds();
  return routeRepo.findCompletedByTeamInPeriodExcludingRouteIds(
    teamId,
    periodStart,
    periodEnd,
    billedIds
  );
}

export function periodBoundsFromRoutes(routes: Route[]): { periodStart: Date; periodEnd: Date } {
  if (routes.length === 0) {
    throw new Error('Cannot derive period from empty routes');
  }
  let min = routes[0].scheduleDate.getTime();
  let max = min;
  for (const route of routes) {
    const t = route.scheduleDate.getTime();
    if (t < min) min = t;
    if (t > max) max = t;
  }
  const periodStart = parseScheduleDate(formatScheduleDate(new Date(min)));
  const periodEnd = parseScheduleDate(formatScheduleDate(new Date(max)));
  return { periodStart, periodEnd };
}

export function parsePayrollPeriodInput(
  periodStartRaw?: string,
  periodEndRaw?: string
): { periodStart: Date; periodEnd: Date } {
  if (!periodStartRaw?.trim() || !periodEndRaw?.trim()) {
    throw new Error('periodStart and periodEnd are required');
  }
  const startStr = periodStartRaw.trim();
  const endStr = periodEndRaw.trim();
  // Compare calendar strings (YYYY-MM-DD). Server stores schedule dates in UTC; clients may
  // send local "today" up to one calendar day ahead of UTC — allow that cushion.
  const maxEndStr = maxPayrollPeriodEndDate();
  if (endStr > maxEndStr) {
    throw new Error('periodEnd cannot be in the future');
  }
  if (endStr < startStr) {
    throw new Error('periodEnd must be on or after periodStart');
  }
  return {
    periodStart: parseScheduleDate(startStr),
    periodEnd: parseScheduleDate(endStr),
  };
}
