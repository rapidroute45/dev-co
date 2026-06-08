import type { StoreBillingSettings } from '../../domain/entities/storeBillingSettings.entity';
import type { StoreBillingRateOverride } from '../../domain/entities/storeBillingRateOverride.entity';

export type RouteRateTriple = {
  smallRouteRate: number;
  mediumRouteRate: number;
  fullRouteRate: number;
};

export type StoreBillingExtras = {
  overtimeHourlyRate: number;
  weeklyPerformanceIncentive: number;
};

export type ResolvedStoreBillingRates = RouteRateTriple & {
  usesCustomRates: boolean;
};

export type FullStoreBillingRates = ResolvedStoreBillingRates & StoreBillingExtras;

export function toRateTriple(
  source: RouteRateTriple
): RouteRateTriple {
  return {
    smallRouteRate: source.smallRouteRate,
    mediumRouteRate: source.mediumRouteRate,
    fullRouteRate: source.fullRouteRate,
  };
}

export function resolveStoreBillingRates(
  defaults: StoreBillingSettings | RouteRateTriple,
  override?: StoreBillingRateOverride | RouteRateTriple | null
): ResolvedStoreBillingRates {
  if (!override) {
    return { ...toRateTriple(defaults), usesCustomRates: false };
  }
  return { ...toRateTriple(override), usesCustomRates: true };
}

type BillingExtrasSource = {
  overtimeHourlyRate?: number | null;
  weeklyPerformanceIncentive?: number | null;
};

export function resolveFullStoreBillingRates(
  defaults: RouteRateTriple & StoreBillingExtras,
  override?: (RouteRateTriple & BillingExtrasSource) | null
): FullStoreBillingRates {
  const base = resolveStoreBillingRates(defaults, override);
  return {
    ...base,
    overtimeHourlyRate: override?.overtimeHourlyRate ?? defaults.overtimeHourlyRate,
    weeklyPerformanceIncentive:
      override?.weeklyPerformanceIncentive ?? defaults.weeklyPerformanceIncentive,
  };
}

export function mapOverridesByStoreId(
  overrides: StoreBillingRateOverride[]
): Map<string, StoreBillingRateOverride> {
  return new Map(overrides.map((o) => [o.storeId, o]));
}
