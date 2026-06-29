import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export interface StoreBillingSettingsDocument {
  _id: Types.ObjectId;
  smallRouteRate: number;
  mediumRouteRate: number;
  fullRouteRate: number;
  overtimeHourlyRate: number;
  weeklyPerformanceIncentive: number;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

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

export const StoreBillingSettingsModel = createScopedModel<StoreBillingSettingsDocument>(
  'StoreBillingSettings',
  StoreBillingSettingsSchema
);
