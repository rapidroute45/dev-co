import type { Route } from '../../../schedules/domain/entities/route.entity';
import type { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import type { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import {
  formatScheduleDate,
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
