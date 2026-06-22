import { StoreRepository } from '../../../stores/infrastructure/repositories/store.repository';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { RouteRepository } from '../../../schedules/infrastructure/repositories/route.repository';
import { StoreBillingSettingsRepository } from '../../infrastructure/repositories/storeBillingSettings.repository';
import { StoreBillingRateOverrideRepository } from '../../infrastructure/repositories/storeBillingRateOverride.repository';
import { storeBillingRateForCategory } from '../services/storeBillingCalculation.service';
import {
  mapOverridesByStoreId,
  resolveStoreBillingRates,
} from '../services/storeBillingResolution.service';
import { RouteCategory } from '../../../../shared/constants/routeCategories';
import { formatScheduleDate } from '../../../schedules/application/utils/scheduleDate';
import { parsePayrollPeriodInput } from '../utils/unbilledPayrollRoutes';
import { CityActor, mergeCityListFilter, resolveGlobalLocationQuery } from '../../../../shared/services/cityScope.service';

export class GetStorePayrollSummaryUseCase {
  constructor(
    private readonly storeRepo = new StoreRepository(),
    private readonly scheduleRepo = new ScheduleRepository(),
    private readonly routeRepo = new RouteRepository(),
    private readonly billingSettingsRepo = new StoreBillingSettingsRepository(),
    private readonly billingOverrideRepo = new StoreBillingRateOverrideRepository()
  ) {}

  async execute(
    input?: { periodStart?: string; periodEnd?: string; search?: string; city?: string; state?: string },
    actor?: CityActor
  ) {
    const period =
      input?.periodStart && input?.periodEnd
        ? parsePayrollPeriodInput(input.periodStart, input.periodEnd)
        : null;

    const scopedInput = resolveGlobalLocationQuery(actor, {
      ...(input?.city ? { city: input.city } : {}),
      ...(input?.state ? { state: input.state } : {}),
    });
    const cityFilter = mergeCityListFilter(actor, scopedInput.city);

    const [settings, { items: stores }] = await Promise.all([
      this.billingSettingsRepo.getOrCreate(),
      this.storeRepo.findMany({
        search: input?.search,
        city: cityFilter.city,
        cities: cityFilter.cities,
        state: scopedInput.state?.trim() || undefined,
        limit: 500,
        page: 1,
      }),
    ]);

    const storeIds = stores.map((s) => s.id!).filter(Boolean);
    const overrides = await this.billingOverrideRepo.findByStoreIds(storeIds);
    const overrideByStoreId = mapOverridesByStoreId(overrides);

    const summaries = await Promise.all(
      stores.map(async (store) => {
        const scheduleIds = await this.scheduleRepo.findAllIdsByStoreId(store.id!);
        const routes = await this.routeRepo.findCompletedByScheduleIdsInPeriod(
          scheduleIds,
          period?.periodStart,
          period?.periodEnd
        );
        const rates = resolveStoreBillingRates(
          settings,
          overrideByStoreId.get(store.id!) ?? null
        );
        let totalAmount = 0;
        for (const route of routes) {
          const category = (route.routeCategory as RouteCategory) ?? RouteCategory.SMALL;
          totalAmount += storeBillingRateForCategory(rates, category);
        }
        return {
          storeId: store.id,
          storeName: store.storeName,
          storeCode: store.storeId,
          city: store.city,
          state: store.state,
          completedRouteCount: routes.length,
          totalAmount,
          usesCustomRates: rates.usesCustomRates,
        };
      })
    );

    return {
      periodStart: period ? formatScheduleDate(period.periodStart) : null,
      periodEnd: period ? formatScheduleDate(period.periodEnd) : null,
      stores: summaries.sort((a, b) => a.storeName.localeCompare(b.storeName)),
    };
  }
}
