import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';
import { NotificationType } from '../../domain/entities/notification.entity';

export interface NotificationDocument {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  read: boolean;
  pushSent?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

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

export const NotificationModel = createScopedModel<NotificationDocument>(
  'Notification',
  NotificationSchema
);
