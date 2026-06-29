import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';
import { StoreActiveStatus } from '../../../../shared/constants/storeStatuses';

export interface StoreDocument {
  _id: Types.ObjectId;
  storeName: string;
  storeId: string;
  city: string;
  state: string;
  address?: string | null;
  activeStatus: StoreActiveStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

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

export const StoreModel = createScopedModel<StoreDocument>('Store', StoreSchema);
