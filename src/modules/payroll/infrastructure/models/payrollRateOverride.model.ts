import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export interface PayrollRateOverrideDocument {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  smallRouteRate: number;
  mediumRouteRate: number;
  fullRouteRate: number;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const PayrollRateOverrideSchema = new Schema(
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
    updatedBy: { type: Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const PayrollRateOverrideModel = createScopedModel<PayrollRateOverrideDocument>(
  'PayrollRateOverride',
  PayrollRateOverrideSchema
);
