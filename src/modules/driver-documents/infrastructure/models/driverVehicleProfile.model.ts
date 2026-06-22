import mongoose from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

const driverVehicleProfileSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
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

export const DriverVehicleProfileModel = createScopedModel(
  'DriverVehicleProfile',
  driverVehicleProfileSchema
);
