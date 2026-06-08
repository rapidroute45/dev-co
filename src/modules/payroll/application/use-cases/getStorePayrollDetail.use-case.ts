import { StoreRepository } from '../../../stores/infrastructure/repositories/store.repository';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { RouteRepository } from '../../../schedules/infrastructure/repositories/route.repository';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { StoreBillingSettingsRepository } from '../../infrastructure/repositories/storeBillingSettings.repository';
import { StoreBillingRateOverrideRepository } from '../../infrastructure/repositories/storeBillingRateOverride.repository';
import { storeBillingRateForCategory } from '../services/storeBillingCalculation.service';
import {
  resolveStoreBillingRates,
  toRateTriple,
} from '../services/storeBillingResolution.service';
import { RouteCategory } from '../../../../shared/constants/routeCategories';
import { formatScheduleDate } from '../../../schedules/application/utils/scheduleDate';
import { parsePayrollPeriodInput } from '../utils/unbilledPayrollRoutes';
import { formatMinutesToTime } from '../../../../shared/utils/parseTime';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';
import { AppError } from '../../../../shared/errors/app-error';

export class GetStorePayrollDetailUseCase {
  constructor(
    private readonly storeRepo = new StoreRepository(),
    private readonly scheduleRepo = new ScheduleRepository(),
    private readonly routeRepo = new RouteRepository(),
    private readonly userRepo = new UserRepository(),
    private readonly billingSettingsRepo = new StoreBillingSettingsRepository(),
    private readonly billingOverrideRepo = new StoreBillingRateOverrideRepository()
  ) {}

  async execute(
    input: {
      storeId: string;
      periodStart?: string;
      periodEnd?: string;
    },
    actor?: CityActor
  ) {
    const store = await this.storeRepo.findById(input.storeId);
    if (!store) throw new AppError('Store not found', 404);
    enforceActorCity(actor, store.city);

    const period =
      input.periodStart && input.periodEnd
        ? parsePayrollPeriodInput(input.periodStart, input.periodEnd)
        : null;

    const [settings, override, scheduleIds] = await Promise.all([
      this.billingSettingsRepo.getOrCreate(),
      this.billingOverrideRepo.findByStoreId(store.id!),
      this.scheduleRepo.findAllIdsByStoreId(store.id!),
    ]);
    const rates = resolveStoreBillingRates(settings, override);

    const routes = await this.routeRepo.findCompletedByScheduleIdsInPeriod(
      scheduleIds,
      period?.periodStart,
      period?.periodEnd
    );

    const driverIds = [...new Set(routes.map((r) => r.driverId).filter(Boolean))] as string[];
    const drivers = await Promise.all(driverIds.map((id) => this.userRepo.findById(id)));
    const driverNameById = new Map<string, string>();
    for (const d of drivers) {
      if (d?.id) driverNameById.set(d.id, d.fullName ?? d.email);
    }

    const routeRows = routes.map((route) => {
      const category = (route.routeCategory as RouteCategory) ?? RouteCategory.SMALL;
      const rate = storeBillingRateForCategory(rates, category);
      return {
        routeId: route.id,
        scheduleDate: formatScheduleDate(route.scheduleDate),
        arrivalTime: formatMinutesToTime(route.arrivalMinutes),
        driverId: route.driverId,
        driverName: route.driverId ? driverNameById.get(route.driverId) ?? 'Unknown' : null,
        routeCategory: category,
        rate,
      };
    });

    const totalAmount = routeRows.reduce((sum, r) => sum + r.rate, 0);

    return {
      store: {
        id: store.id,
        storeName: store.storeName,
        storeCode: store.storeId,
        city: store.city,
        state: store.state,
      },
      periodStart: period ? formatScheduleDate(period.periodStart) : null,
      periodEnd: period ? formatScheduleDate(period.periodEnd) : null,
      rates: {
        smallRouteRate: rates.smallRouteRate,
        mediumRouteRate: rates.mediumRouteRate,
        fullRouteRate: rates.fullRouteRate,
        usesCustomRates: rates.usesCustomRates,
        defaultRates: toRateTriple(settings),
      },
      routes: routeRows,
      totalAmount,
      completedRouteCount: routeRows.length,
    };
  }
}
