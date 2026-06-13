import { StoreBillingSettingsRepository } from '../../infrastructure/repositories/storeBillingSettings.repository';

export class GetStoreBillingSettingsUseCase {
  constructor(private readonly repo = new StoreBillingSettingsRepository()) {}

  async execute() {
    const settings = await this.repo.getOrCreate();
    return {
      id: settings.id,
      scope: 'default' as const,
      smallRouteRate: settings.smallRouteRate,
      mediumRouteRate: settings.mediumRouteRate,
      fullRouteRate: settings.fullRouteRate,
      overtimeHourlyRate: settings.overtimeHourlyRate,
      weeklyPerformanceIncentive: settings.weeklyPerformanceIncentive,
      updatedAt: settings.updatedAt?.toISOString() ?? null,
    };
  }
}
