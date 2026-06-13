import { Schema, model, Types } from 'mongoose';

const StoreBillingSettingsSchema = new Schema(
  {
    smallRouteRate: { type: Number, required: true, default: 200 },
    mediumRouteRate: { type: Number, required: true, default: 300 },
    fullRouteRate: { type: Number, required: true, default: 400 },
    overtimeHourlyRate: { type: Number, required: true, default: 30 },
    weeklyPerformanceIncentive: { type: Number, required: true, default: 0 },
    updatedBy: { type: Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const StoreBillingSettingsModel = model(
  'StoreBillingSettings',
  StoreBillingSettingsSchema
);
