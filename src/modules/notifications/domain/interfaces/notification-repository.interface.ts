import { Notification, NotificationType } from '../entities/notification.entity';

export interface INotificationRepository {
  save(notification: Notification): Promise<Notification>;
  findManyByRecipient(recipientId: string, limit?: number): Promise<Notification[]>;
  markRead(id: string, recipientId: string): Promise<Notification | null>;
  markPushSentForRecipients(
    recipientIds: string[],
    type: NotificationType,
    withinMs?: number
  ): Promise<number>;
}
