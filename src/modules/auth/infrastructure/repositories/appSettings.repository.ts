import { ENV } from '../../../../config/env';
import { AppSettingsModel, AppSettingsDoc } from '../models/appSettings.model';

const DEV_DEFAULT_SETTINGS: AppSettingsDoc = {
  dispatchElevationPin: '4545',
  payrollElevationPin: '4545',
};

function productionDefaultSettings(): AppSettingsDoc {
  return {
    dispatchElevationPin: ENV.OPS_DISPATCH_ELEVATION_PIN,
    payrollElevationPin: ENV.OPS_PAYROLL_ELEVATION_PIN,
  };
}

function defaultSettingsForEnv(): AppSettingsDoc {
  return ENV.APP_ENV === 'production' ? productionDefaultSettings() : DEV_DEFAULT_SETTINGS;
}

export class AppSettingsRepository {
  async findExisting(): Promise<AppSettingsDoc | null> {
    const existing = await AppSettingsModel.findOne().lean();
    if (!existing) return null;
    return {
      dispatchElevationPin: existing.dispatchElevationPin,
      payrollElevationPin: existing.payrollElevationPin,
    };
  }

  async getOrCreate(): Promise<AppSettingsDoc> {
    const existing = await this.findExisting();
    if (existing) {
      return existing;
    }

    const created = await AppSettingsModel.create(defaultSettingsForEnv());
    return {
      dispatchElevationPin: created.dispatchElevationPin,
      payrollElevationPin: created.payrollElevationPin,
    };
  }
}
