import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export interface DriverVehicleProfileDocument {
  _id: Types.ObjectId;
  driverId: Types.ObjectId;
  plateNumber?: string | null;
  vehiclePhotoUrl?: string | null;
  vehiclePhotoMimeType?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const driverVehicleProfileSchema = new Schema(
  {
    driverId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    plateNumber: { type: String, default: null, trim: true },
    vehiclePhotoUrl: { type: String, default: null },
    vehiclePhotoMimeType: { type: String, default: null },
  },
  { timestamps: true }
);

export const DriverVehicleProfileModel = createScopedModel<DriverVehicleProfileDocument>(
  'DriverVehicleProfile',
  driverVehicleProfileSchema
);
