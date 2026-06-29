import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

const DeviceTokenSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true, index: true },
    deviceId: { type: String, trim: true, default: null },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DeviceTokenSchema.index({ userId: 1, platform: 1 });

export const DeviceTokenModel = createScopedModel('DeviceToken', DeviceTokenSchema);
