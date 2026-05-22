import { Schema, model } from 'mongoose';
import { StoreActiveStatus } from '../../../../shared/constants/storeStatuses';

const StoreSchema = new Schema(
  {
    storeName: { type: String, required: true, trim: true },
    storeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: null },
    activeStatus: {
      type: String,
      enum: Object.values(StoreActiveStatus),
      default: StoreActiveStatus.ACTIVE,
    },
  },
  { timestamps: true }
);

StoreSchema.index({ city: 1, state: 1 });
StoreSchema.index({ storeName: 'text', city: 1 });

export const StoreModel = model('Store', StoreSchema);
