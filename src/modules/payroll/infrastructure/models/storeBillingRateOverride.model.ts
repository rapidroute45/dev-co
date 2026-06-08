import { Schema, model, Types } from 'mongoose';

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

export const StoreBillingRateOverrideModel = model(
  'StoreBillingRateOverride',
  StoreBillingRateOverrideSchema
);
