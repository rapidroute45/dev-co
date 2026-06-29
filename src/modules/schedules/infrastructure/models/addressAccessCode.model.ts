import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export interface AddressAccessCodeDocument {
  _id: Types.ObjectId;
  normalizedAddress: string;
  accessCode: string;
  sampleName?: string | null;
  lastUsedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AddressAccessCodeSchema = new Schema(
  {
    normalizedAddress: { type: String, required: true, unique: true, index: true },
    accessCode: { type: String, trim: true, required: true },
    sampleName: { type: String, trim: true, default: null },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const AddressAccessCodeModel = createScopedModel<AddressAccessCodeDocument>(
  'AddressAccessCode',
  AddressAccessCodeSchema
);
