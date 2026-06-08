import { StoreBillingSettingsRepository } from '../../infrastructure/repositories/storeBillingSettings.repository';

export class UpdateStoreBillingSettingsUseCase {
  constructor(private readonly repo = new StoreBillingSettingsRepository()) {}

  async execute(input: {
    smallRouteRate: number;
    mediumRouteRate: number;
    fullRouteRate: number;
    overtimeHourlyRate: number;
    weeklyPerformanceIncentive: number;
    updatedBy: string;
  }) {
    for (const rate of [
      input.smallRouteRate,
      input.mediumRouteRate,
      input.fullRouteRate,
      input.overtimeHourlyRate,
      input.weeklyPerformanceIncentive,
    ]) {
      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error('Rates must be non-negative numbers');
      }
    }
    const settings = await this.repo.update(input);
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
