import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export interface StoreBillingRateOverrideDocument {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  smallRouteRate: number;
  mediumRouteRate: number;
  fullRouteRate: number;
  overtimeHourlyRate?: number | null;
  weeklyPerformanceIncentive?: number | null;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const StoreBillingRateOverrideSchema = new Schema(
  {
    storeId: {
      type: Types.ObjectId,
      ref: 'Store',
      required: true,
      unique: true,
      index: true,
    },
    smallRouteRate: { type: Number, required: true },
    mediumRouteRate: { type: Number, required: true },
    fullRouteRate: { type: Number, required: true },
    overtimeHourlyRate: { type: Number, default: null },
    weeklyPerformanceIncentive: { type: Number, default: null },
    updatedBy: { type: Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const StoreBillingRateOverrideModel = createScopedModel<StoreBillingRateOverrideDocument>(
  'StoreBillingRateOverride',
  StoreBillingRateOverrideSchema
);
