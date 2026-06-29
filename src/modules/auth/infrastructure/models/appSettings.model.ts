import { Schema } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export interface AppSettingsDocument {
  dispatchElevationPin: string;
  payrollElevationPin: string;
}

export type AppSettingsDoc = AppSettingsDocument;

const AppSettingsSchema = new Schema(
  {
    dispatchElevationPin: { type: String, required: true, default: '4545' },
    payrollElevationPin: { type: String, required: true, default: '4545' },
  },
  { timestamps: true }
);

export const AppSettingsModel = createScopedModel<AppSettingsDocument>(
  'AppSettings',
  AppSettingsSchema
);
