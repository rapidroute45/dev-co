import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export interface PayrollRouteAdjustmentDocument {
  _id: Types.ObjectId;
  routeId: Types.ObjectId;
  driverId: Types.ObjectId;
  teamId: Types.ObjectId;
  originalAmount: number;
  adjustedAmount: number;
  reason?: string | null;
  adjustedBy: Types.ObjectId;
  adjustedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

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

export const PayrollRouteAdjustmentModel = createScopedModel<PayrollRouteAdjustmentDocument>(
  'PayrollRouteAdjustment',
  PayrollRouteAdjustmentSchema
);
