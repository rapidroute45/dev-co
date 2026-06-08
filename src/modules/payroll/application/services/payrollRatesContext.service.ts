import type { Route } from '../../../schedules/domain/entities/route.entity';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { PayrollSettingsRepository } from '../../infrastructure/repositories/payrollSettings.repository';
import { PayrollRateOverrideRepository } from '../../infrastructure/repositories/payrollRateOverride.repository';
import {
  resolveStoreBillingRates,
  toRateTriple,
  type RouteRateTriple,
} from './storeBillingResolution.service';

export type PayrollRateContext = {
  defaults: RouteRateTriple;
  storeIdByScheduleId: Map<string, string>;
  overrideByStoreId: Map<string, RouteRateTriple>;
};

export function resolvePayrollRatesForRoute(
  ctx: PayrollRateContext,
  route: Route
): RouteRateTriple {
  const storeId = ctx.storeIdByScheduleId.get(route.scheduleId);
  if (!storeId) return ctx.defaults;
  const override = ctx.overrideByStoreId.get(storeId);
  return resolveStoreBillingRates(ctx.defaults, override ?? null);
}

export async function buildPayrollRateContext(
  routes: Route[],
  settingsRepo: PayrollSettingsRepository,
  overrideRepo: PayrollRateOverrideRepository,
  scheduleRepo: ScheduleRepository
): Promise<PayrollRateContext> {
  const scheduleIds = [...new Set(routes.map((r) => r.scheduleId).filter(Boolean))];
  const [defaults, storeIdByScheduleId] = await Promise.all([
    settingsRepo.getOrCreate(),
    scheduleRepo.findStoreIdByIds(scheduleIds),
  ]);
  const storeIds = [...new Set(storeIdByScheduleId.values())];
  const overrides = await overrideRepo.findByStoreIds(storeIds);

  return {
    defaults: toRateTriple(defaults),
    storeIdByScheduleId,
    overrideByStoreId: new Map(
      overrides.map((o) => [o.storeId, toRateTriple(o)])
    ),
  };
}
