import { AppSettingsModel, AppSettingsDoc } from '../models/appSettings.model';

const DEFAULT_SETTINGS: AppSettingsDoc = {
  dispatchElevationPin: '4545',
  payrollElevationPin: '4545',
};

export class AppSettingsRepository {
  async getOrCreate(): Promise<AppSettingsDoc> {
    let doc = await AppSettingsModel.findOne().lean<AppSettingsDoc>();
    if (!doc) {
      doc = (await AppSettingsModel.create(DEFAULT_SETTINGS)).toObject() as AppSettingsDoc;
    }
    return doc;
  }
}
