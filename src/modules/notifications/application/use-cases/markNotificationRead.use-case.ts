import { AppError } from '../../../../shared/errors/app-error';
import { INotificationRepository } from '../../domain/interfaces/notification-repository.interface';

export class MarkNotificationReadUseCase {
  constructor(private notificationRepo: INotificationRepository) {}

  async execute(recipientId: string, notificationId: string) {
    const updated = await this.notificationRepo.markRead(notificationId, recipientId);
    if (!updated) throw new AppError('Notification not found.', 404);

    return {
      id: updated.id,
      read: updated.read,
    };
  }
}
