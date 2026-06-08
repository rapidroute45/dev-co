import { RouteCategory } from '../../../../shared/constants/routeCategories';
import type { Route } from '../../../schedules/domain/entities/route.entity';
import type { PayrollRouteAdjustmentRecord } from '../../infrastructure/repositories/payrollRouteAdjustment.repository';
import type { RouteRateTriple } from './storeBillingResolution.service';

export type RoutePayBreakdown = {
  routeId: string;
  routeCategory: RouteCategory;
  defaultRate: number;
  originalAmount: number;
  rate: number;
  hasAdjustment: boolean;
  adjustmentReason: string | null;
};

export function defaultRateForCategory(
  rates: RouteRateTriple,
  category: RouteCategory
): number {
  switch (category) {
    case RouteCategory.MEDIUM:
      return rates.mediumRouteRate;
    case RouteCategory.FULL:
      return rates.fullRouteRate;
    case RouteCategory.SMALL:
    default:
      return rates.smallRouteRate;
  }
}

export function resolveRoutePay(
  route: Route,
  rates: RouteRateTriple,
  adjustment: PayrollRouteAdjustmentRecord | null | undefined
): RoutePayBreakdown {
  const category = route.routeCategory;
  const defaultRate = defaultRateForCategory(rates, category);
  const originalAmount = defaultRate;
  const rate = adjustment?.adjustedAmount ?? defaultRate;

  return {
    routeId: route.id!,
    routeCategory: category,
    defaultRate,
    originalAmount: adjustment?.originalAmount ?? originalAmount,
    rate,
    hasAdjustment: Boolean(adjustment),
    adjustmentReason: adjustment?.reason ?? null,
  };
}

export function buildAdjustmentMap(
  adjustments: PayrollRouteAdjustmentRecord[]
): Map<string, PayrollRouteAdjustmentRecord> {
  return new Map(adjustments.map((a) => [a.routeId, a]));
}
