import { AppError } from '../../../../shared/errors/app-error';
import { StoreRepository } from '../../../stores/infrastructure/repositories/store.repository';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { RouteRepository } from '../../../schedules/infrastructure/repositories/route.repository';
import { StoreBillingSettingsRepository } from '../../infrastructure/repositories/storeBillingSettings.repository';
import { StoreBillingRateOverrideRepository } from '../../infrastructure/repositories/storeBillingRateOverride.repository';
import { InvoiceBillToRepository } from '../../infrastructure/repositories/invoiceBillTo.repository';
import { buildStoreInvoiceData } from '../services/buildStoreInvoice.service';
import { parsePayrollPeriodInput } from '../utils/unbilledPayrollRoutes';
import { formatScheduleDate } from '../../../schedules/application/utils/scheduleDate';
import { CityActor, enforceActorCity, mergeCityFilter } from '../../../../shared/services/cityScope.service';
import type { Store } from '../../../stores/domain/entities/store.entity';

function parseStoreIds(input: {
  storeId?: string;
  storeIds?: string | string[];
}): string[] | null {
  if (input.storeIds !== undefined && input.storeIds !== null) {
    const raw = Array.isArray(input.storeIds) ? input.storeIds : String(input.storeIds).split(',');
    const ids = raw.map((id) => String(id).trim()).filter(Boolean);
    return ids.length > 0 ? ids : null;
  }
  const single = input.storeId?.trim();
  return single ? [single] : null;
}

export class ListInvoiceBillTosUseCase {
  constructor(private readonly repo = new InvoiceBillToRepository()) {}

  async execute() {
    const items = await this.repo.findAll();
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      address: item.address,
    }));
  }
}

export class UpsertInvoiceBillToUseCase {
  constructor(private readonly repo = new InvoiceBillToRepository()) {}

  async execute(input: { name: string; address: string; updatedBy: string }) {
    const saved = await this.repo.upsert(input);
    return {
      id: saved.id,
      name: saved.name,
      address: saved.address,
    };
  }
}

export class BuildStoreInvoiceUseCase {
  constructor(
    private readonly storeRepo = new StoreRepository(),
    private readonly scheduleRepo = new ScheduleRepository(),
    private readonly routeRepo = new RouteRepository(),
    private readonly billingSettingsRepo = new StoreBillingSettingsRepository(),
    private readonly billingOverrideRepo = new StoreBillingRateOverrideRepository(),
    private readonly billToRepo = new InvoiceBillToRepository()
  ) {}

  async execute(
    input: {
      periodStart: string;
      periodEnd: string;
      search?: string;
      city?: string;
      state?: string;
      storeId?: string;
      storeIds?: string | string[];
      billToName?: string;
      billToAddress?: string;
      weeklyPerformanceIncentiveRate?: number;
      ruralAmount?: number;
      overtimeAmount?: number;
      saveBillTo?: boolean;
      updatedBy?: string;
    },
    actor?: CityActor
  ) {
    const period = parsePayrollPeriodInput(input.periodStart, input.periodEnd);
    const city = mergeCityFilter(actor, input.city);

    const billToName = input.billToName?.trim();
    const billToAddress = input.billToAddress?.trim();
    if (!billToName) throw new AppError('Bill-to name is required', 400);
    if (!billToAddress) throw new AppError('Bill-to address is required', 400);

    if (input.saveBillTo && input.updatedBy) {
      await this.billToRepo.upsert({
        name: billToName,
        address: billToAddress,
        updatedBy: input.updatedBy,
      });
    }

    const defaults = await this.billingSettingsRepo.getOrCreate();

    let stores: Store[];
    const requestedStoreIds = parseStoreIds(input);
    if (requestedStoreIds) {
      stores = [];
      for (const id of requestedStoreIds) {
        const store = await this.storeRepo.findById(id);
        if (!store) throw new AppError(`Store not found: ${id}`, 404);
        enforceActorCity(actor, store.city);
        stores.push(store);
      }
    } else {
      const { items } = await this.storeRepo.findMany({
        search: input.search,
        city,
        state: input.state?.trim() || undefined,
        limit: 500,
        page: 1,
      });
      stores = items;
    }

    const storeIds = stores.map((s) => s.id!).filter(Boolean);
    const overrides = await this.billingOverrideRepo.findByStoreIds(storeIds);

    const allRoutes: Awaited<ReturnType<RouteRepository['findCompletedByScheduleIdsInPeriod']>> = [];

    for (const store of stores) {
      const ids = await this.scheduleRepo.findAllIdsByStoreId(store.id!);
      const routes = await this.routeRepo.findCompletedByScheduleIdsInPeriod(
        ids,
        period.periodStart,
        period.periodEnd
      );
      allRoutes.push(...routes);
    }

    const scheduleStoreIdByScheduleId = await this.scheduleRepo.findStoreIdByIds(
      [...new Set(allRoutes.map((r) => r.scheduleId))]
    );

    const incentiveRate =
      input.weeklyPerformanceIncentiveRate !== undefined &&
      Number.isFinite(input.weeklyPerformanceIncentiveRate)
        ? Number(input.weeklyPerformanceIncentiveRate)
        : defaults.weeklyPerformanceIncentive;

    const ruralAmount =
      input.ruralAmount !== undefined && Number.isFinite(Number(input.ruralAmount))
        ? Math.max(0, Number(input.ruralAmount))
        : 0;

    const overtimeAmount =
      input.overtimeAmount !== undefined && Number.isFinite(Number(input.overtimeAmount))
        ? Math.max(0, Number(input.overtimeAmount))
        : 0;

    const invoice = buildStoreInvoiceData({
      periodStart: formatScheduleDate(period.periodStart),
      periodEnd: formatScheduleDate(period.periodEnd),
      billToName,
      billToAddress,
      weeklyPerformanceIncentiveRate: incentiveRate,
      ruralAmount,
      overtimeAmount,
      stores: stores
        .filter((s) => s.id)
        .map((s) => ({ id: s.id!, storeName: s.storeName })),
      routes: allRoutes,
      scheduleStoreIdByScheduleId,
      defaults,
      overrides,
    });

    return {
      ...invoice,
      defaults: {
        weeklyPerformanceIncentive: defaults.weeklyPerformanceIncentive,
      },
    };
  }
}
