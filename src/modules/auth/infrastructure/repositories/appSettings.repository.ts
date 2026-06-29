import { AppSettingsModel, AppSettingsDoc } from '../models/appSettings.model';

const DEFAULT_SETTINGS: AppSettingsDoc = {
  dispatchElevationPin: '4545',
  payrollElevationPin: '4545',
};

export class AppSettingsRepository {
  async getOrCreate(): Promise<AppSettingsDoc> {
    const existing = await AppSettingsModel.findOne().lean();
    if (existing) {
      return {
        dispatchElevationPin: existing.dispatchElevationPin,
        payrollElevationPin: existing.payrollElevationPin,
      };
    }

    const created = await AppSettingsModel.create(DEFAULT_SETTINGS);
    return {
      dispatchElevationPin: created.dispatchElevationPin,
      payrollElevationPin: created.payrollElevationPin,
    };
  }
}
