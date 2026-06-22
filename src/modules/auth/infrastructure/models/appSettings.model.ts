import { Schema } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

const AppSettingsSchema = new Schema(
  {
    dispatchElevationPin: { type: String, required: true, default: '4545' },
    payrollElevationPin: { type: String, required: true, default: '4545' },
  },
  { timestamps: true }
);

export const AppSettingsModel = createScopedModel('AppSettings', AppSettingsSchema);

export type AppSettingsDoc = {
  dispatchElevationPin: string;
  payrollElevationPin: string;
};
