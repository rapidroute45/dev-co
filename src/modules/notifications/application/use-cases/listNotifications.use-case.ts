import { INotificationRepository } from '../../domain/interfaces/notification-repository.interface';

export class ListNotificationsUseCase {
  constructor(private notificationRepo: INotificationRepository) {}

  async execute(recipientId: string) {
    const items = await this.notificationRepo.findManyByRecipient(recipientId);
    return items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      payload: n.payload,
      read: n.read,
      createdAt: n.createdAt,
    }));
  }
}
