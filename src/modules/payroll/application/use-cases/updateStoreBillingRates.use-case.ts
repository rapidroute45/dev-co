import { AppError } from '../../../../shared/errors/app-error';
import { StoreRepository } from '../../../stores/infrastructure/repositories/store.repository';
import { StoreBillingSettingsRepository } from '../../infrastructure/repositories/storeBillingSettings.repository';
import { StoreBillingRateOverrideRepository } from '../../infrastructure/repositories/storeBillingRateOverride.repository';
import {
  resolveStoreBillingRates,
  toRateTriple,
} from '../services/storeBillingResolution.service';

export class UpdateStoreBillingRatesUseCase {
  constructor(
    private readonly storeRepo = new StoreRepository(),
    private readonly defaultsRepo = new StoreBillingSettingsRepository(),
    private readonly overrideRepo = new StoreBillingRateOverrideRepository()
  ) {}

  async execute(
    storeId: string,
    input: {
      useDefaultRates?: boolean;
      smallRouteRate?: number;
      mediumRouteRate?: number;
      fullRouteRate?: number;
      updatedBy: string;
    }
  ) {
    const store = await this.storeRepo.findById(storeId);
    if (!store) throw new AppError('Store not found', 404);

    const defaults = await this.defaultsRepo.getOrCreate();

    if (input.useDefaultRates === true) {
      await this.overrideRepo.deleteByStoreId(storeId);
      const resolved = resolveStoreBillingRates(defaults, null);
      return {
        storeId: store.id,
        storeName: store.storeName,
        usesCustomRates: false,
        smallRouteRate: resolved.smallRouteRate,
        mediumRouteRate: resolved.mediumRouteRate,
        fullRouteRate: resolved.fullRouteRate,
        defaultRates: toRateTriple(defaults),
        customRates: null,
      };
    }

    if (
      input.smallRouteRate === undefined ||
      input.mediumRouteRate === undefined ||
      input.fullRouteRate === undefined
    ) {
      throw new AppError(
        'smallRouteRate, mediumRouteRate, and fullRouteRate are required for custom rates',
        400
      );
    }

    const rates = [
      input.smallRouteRate,
      input.mediumRouteRate,
      input.fullRouteRate,
    ];
    if (rates.some((r) => !Number.isFinite(r) || r < 0)) {
      throw new AppError('Route rates must be non-negative numbers', 400);
    }

    const override = await this.overrideRepo.upsert(storeId, {
      smallRouteRate: Number(input.smallRouteRate),
      mediumRouteRate: Number(input.mediumRouteRate),
      fullRouteRate: Number(input.fullRouteRate),
      overtimeHourlyRate: defaults.overtimeHourlyRate,
      weeklyPerformanceIncentive: defaults.weeklyPerformanceIncentive,
      updatedBy: input.updatedBy,
    });

    const resolved = resolveStoreBillingRates(defaults, override);
    return {
      storeId: store.id,
      storeName: store.storeName,
      usesCustomRates: true,
      smallRouteRate: resolved.smallRouteRate,
      mediumRouteRate: resolved.mediumRouteRate,
      fullRouteRate: resolved.fullRouteRate,
      defaultRates: toRateTriple(defaults),
      customRates: toRateTriple(override),
    };
  }
}
