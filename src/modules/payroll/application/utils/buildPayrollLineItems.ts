import type { Route } from '../../../schedules/domain/entities/route.entity';
import type { PayrollDriverLine } from '../../domain/entities/payrollBill.entity';
import { STANDARD_ROUTE_RATE } from '../payroll.constants';

export function buildPayrollLineItems(
  routes: Route[],
  nameById: Map<string, string>
): PayrollDriverLine[] {
  const grouped = new Map<string, PayrollDriverLine>();

  for (const route of routes) {
    const driverId = route.driverId;
    if (!driverId || !route.id) continue;

    let line = grouped.get(driverId);
    if (!line) {
      line = {
        driverId,
        driverName: nameById.get(driverId) ?? 'Driver',
        routeCount: 0,
        basePay: 0,
        bonus: 0,
        deduction: 0,
        overtime: 0,
        total: 0,
        routes: [],
      };
      grouped.set(driverId, line);
    }

    line.routes.push({
      routeId: route.id,
      routeName: route.routeName ?? null,
      location: route.location ?? null,
      scheduleDate: route.scheduleDate,
      completedAt: route.completedAt ?? null,
      rate: STANDARD_ROUTE_RATE,
    });
    line.routeCount += 1;
    line.basePay += STANDARD_ROUTE_RATE;
  }

  return Array.from(grouped.values()).map((line) => ({
    ...line,
    total: line.basePay + line.bonus + line.overtime - line.deduction,
  }));
}
