import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

const DriverLocationSchema = new Schema(
  {
    routeId: { type: Types.ObjectId, ref: 'Route', required: true, index: true },
    driverId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

DriverLocationSchema.index({ routeId: 1, recordedAt: -1 });

export const DriverLocationModel = createScopedModel('DriverLocation', DriverLocationSchema);
