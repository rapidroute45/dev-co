import { Schema, model, Types } from 'mongoose';
import { NotificationType } from '../../domain/entities/notification.entity';

const NotificationSchema = new Schema(
  {
    recipientId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
    pushSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, createdAt: -1 });

export const NotificationModel = model('Notification', NotificationSchema);
