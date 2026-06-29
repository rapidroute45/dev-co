import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export interface PayrollSettingsDocument {
  _id: Types.ObjectId;
  smallRouteRate: number;
  mediumRouteRate: number;
  fullRouteRate: number;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const PayrollSettingsSchema = new Schema(
  {
    smallRouteRate: { type: Number, required: true, default: 200 },
    mediumRouteRate: { type: Number, required: true, default: 300 },
    fullRouteRate: { type: Number, required: true, default: 400 },
    updatedBy: { type: Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const PayrollSettingsModel = createScopedModel<PayrollSettingsDocument>(
  'PayrollSettings',
  PayrollSettingsSchema
);
