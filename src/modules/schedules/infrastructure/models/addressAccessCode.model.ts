import { Schema, model } from 'mongoose';

const AddressAccessCodeSchema = new Schema(
  {
    normalizedAddress: { type: String, required: true, unique: true, index: true },
    accessCode: { type: String, trim: true, required: true },
    sampleName: { type: String, trim: true, default: null },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const AddressAccessCodeModel = model('AddressAccessCode', AddressAccessCodeSchema);
