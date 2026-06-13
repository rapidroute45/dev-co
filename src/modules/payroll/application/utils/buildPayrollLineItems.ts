import type { Route } from '../../../schedules/domain/entities/route.entity';
import type { PayrollDriverLine } from '../../domain/entities/payrollBill.entity';
import {
  buildAdjustmentMap,
  resolveRoutePay,
} from '../services/payrollCalculation.service';
import type { PayrollRouteAdjustmentRecord } from '../../infrastructure/repositories/payrollRouteAdjustment.repository';
import {
  resolvePayrollRatesForRoute,
  type PayrollRateContext,
} from '../services/payrollRatesContext.service';

export function buildPayrollLineItems(
  routes: Route[],
  nameById: Map<string, string>,
  rateContext: PayrollRateContext,
  adjustments: PayrollRouteAdjustmentRecord[] = []
): PayrollDriverLine[] {
  const adjustmentByRoute = buildAdjustmentMap(adjustments);
  const grouped = new Map<string, PayrollDriverLine>();

  for (const route of routes) {
    const driverId = route.driverId;
    if (!driverId || !route.id) continue;

    const rates = resolvePayrollRatesForRoute(rateContext, route);
    const pay = resolveRoutePay(route, rates, adjustmentByRoute.get(route.id));

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
      rate: pay.rate,
      routeCategory: pay.routeCategory,
      defaultRate: pay.defaultRate,
      originalAmount: pay.originalAmount,
      hasAdjustment: pay.hasAdjustment,
      adjustmentReason: pay.adjustmentReason,
    });
    line.routeCount += 1;
    line.basePay += pay.rate;
  }

  return Array.from(grouped.values()).map((line) => ({
    ...line,
    total: line.basePay + line.bonus + line.overtime - line.deduction,
  }));
}

export function payrollTotalsFromLineItems(lineItems: PayrollDriverLine[]): {
  subtotal: number;
  adjustmentsTotal: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let adjustmentsTotal = 0;
  for (const line of lineItems) {
    for (const r of line.routes) {
      subtotal += r.originalAmount;
      if (r.hasAdjustment) {
        adjustmentsTotal += r.rate - r.originalAmount;
      }
    }
  }
  const totalAmount = lineItems.reduce((sum, line) => sum + line.total, 0);
  return { subtotal, adjustmentsTotal, totalAmount };
}
