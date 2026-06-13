import { AppError } from '../../../../shared/errors/app-error';
import { StoreRepository } from '../../../stores/infrastructure/repositories/store.repository';
import { StoreBillingSettingsRepository } from '../../infrastructure/repositories/storeBillingSettings.repository';
import { StoreBillingRateOverrideRepository } from '../../infrastructure/repositories/storeBillingRateOverride.repository';
import {
  resolveStoreBillingRates,
  toRateTriple,
} from '../services/storeBillingResolution.service';

export class GetStoreBillingRatesUseCase {
  constructor(
    private readonly storeRepo = new StoreRepository(),
    private readonly defaultsRepo = new StoreBillingSettingsRepository(),
    private readonly overrideRepo = new StoreBillingRateOverrideRepository()
  ) {}

  async execute(storeId: string) {
    const store = await this.storeRepo.findById(storeId);
    if (!store) throw new AppError('Store not found', 404);

    const [defaults, override] = await Promise.all([
      this.defaultsRepo.getOrCreate(),
      this.overrideRepo.findByStoreId(storeId),
    ]);

    const resolved = resolveStoreBillingRates(defaults, override);

    return {
      storeId: store.id,
      storeName: store.storeName,
      storeCode: store.storeId,
      usesCustomRates: resolved.usesCustomRates,
      smallRouteRate: resolved.smallRouteRate,
      mediumRouteRate: resolved.mediumRouteRate,
      fullRouteRate: resolved.fullRouteRate,
      defaultRates: toRateTriple(defaults),
      customRates: override ? toRateTriple(override) : null,
    };
  }
}
