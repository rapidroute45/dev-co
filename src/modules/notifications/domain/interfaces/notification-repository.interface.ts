import { Notification } from '../entities/notification.entity';

export interface INotificationRepository {
  save(notification: Notification): Promise<Notification>;
  findManyByRecipient(recipientId: string, limit?: number): Promise<Notification[]>;
  markRead(id: string, recipientId: string): Promise<Notification | null>;
}
