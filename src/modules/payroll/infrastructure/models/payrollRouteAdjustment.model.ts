import { Schema, model, Types } from 'mongoose';

const PayrollRouteAdjustmentSchema = new Schema(
  {
    routeId: { type: Types.ObjectId, ref: 'Route', required: true, unique: true, index: true },
    driverId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    teamId: { type: Types.ObjectId, ref: 'Team', required: true, index: true },
    originalAmount: { type: Number, required: true },
    adjustedAmount: { type: Number, required: true },
    reason: { type: String, trim: true, default: null },
    adjustedBy: { type: Types.ObjectId, ref: 'User', required: true },
    adjustedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

export const PayrollRouteAdjustmentModel = model(
  'PayrollRouteAdjustment',
  PayrollRouteAdjustmentSchema
);
