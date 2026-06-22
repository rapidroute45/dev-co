import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

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

export const StoreBillingRateOverrideModel = createScopedModel(
  'StoreBillingRateOverride',
  StoreBillingRateOverrideSchema
);
