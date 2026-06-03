import mongoose from 'mongoose';
import {
  Notification,
  NotificationType,
} from '../../domain/entities/notification.entity';
import { INotificationRepository } from '../../domain/interfaces/notification-repository.interface';
import { NotificationModel } from '../models/notification.model';

function toRecipientObjectId(recipientId: string): mongoose.Types.ObjectId | null {
  if (!mongoose.Types.ObjectId.isValid(recipientId)) return null;
  return new mongoose.Types.ObjectId(recipientId);
}

/** Match recipient whether stored as ObjectId or legacy string in Mongo. */
function recipientQuery(recipientId: string) {
  const oid = toRecipientObjectId(recipientId);
  if (!oid) return { recipientId };
  return { $or: [{ recipientId: oid }, { recipientId: recipientId }] };
}

function mapDoc(doc: {
  _id: { toString(): string };
  recipientId: { toString(): string };
  type: string;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  read: boolean;
  pushSent?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}): Notification {
  return new Notification({
    id: doc._id.toString(),
    recipientId: doc.recipientId.toString(),
    type: doc.type as NotificationType,
    title: doc.title,
    message: doc.message,
    payload: (doc.payload as Record<string, unknown>) ?? {},
    read: doc.read,
    pushSent: doc.pushSent,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class NotificationRepository implements INotificationRepository {
  async save(notification: Notification): Promise<Notification> {
    const recipientOid =
      toRecipientObjectId(notification.recipientId) ?? notification.recipientId;
    const created = await NotificationModel.create({
      recipientId: recipientOid,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      payload: notification.payload,
      read: notification.read,
      pushSent: notification.pushSent,
    });
    return mapDoc(created);
  }

  async findManyByRecipient(recipientId: string, limit = 50): Promise<Notification[]> {
    const docs = await NotificationModel.find(recipientQuery(recipientId))
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(mapDoc);
  }

  async markRead(id: string, recipientId: string): Promise<Notification | null> {
    const doc = await NotificationModel.findOneAndUpdate(
      { _id: id, ...recipientQuery(recipientId) },
      { read: true },
      { returnDocument: 'after' }
    );
    return doc ? mapDoc(doc) : null;
  }
}
