import {
  Notification,
  NotificationType,
} from '../../domain/entities/notification.entity';
import { INotificationRepository } from '../../domain/interfaces/notification-repository.interface';

export type RouteAssignedNotificationInput = {
  driverId: string;
  teamLeadId: string | null;
  scheduleDate: string;
  storeName: string;
  city: string;
  state: string;
  arrivalTime: string;
  departureTime: string;
  teamName: string;
  routeId: string;
  scheduleId: string;
};

export class NotificationService {
  constructor(private notificationRepo: INotificationRepository) {}

  /**
   * Persists in-app notifications. Push can be wired here when mobile tokens exist.
   */
  async notifyRouteAssigned(input: RouteAssignedNotificationInput): Promise<void> {
    const payload = {
      routeId: input.routeId,
      scheduleId: input.scheduleId,
      scheduleDate: input.scheduleDate,
      storeName: input.storeName,
      city: input.city,
      state: input.state,
      arrivalTime: input.arrivalTime,
      departureTime: input.departureTime,
      teamName: input.teamName,
    };

    const title = 'New route offer';
    const message = `${input.storeName} (${input.city}, ${input.state}) — ${input.arrivalTime} to ${input.departureTime}. Accept or decline in the app.`;

    const recipients = new Set<string>([input.driverId]);
    if (input.teamLeadId) recipients.add(input.teamLeadId);

    await Promise.all(
      [...recipients].map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.ROUTE_OFFER,
            title,
            message,
            payload: { ...payload, requiresAcceptance: true },
            read: false,
            pushSent: false,
          })
        )
      )
    );

    // Hook for FCM/APNs when device tokens are stored on User
    void this.sendPushIfSupported([...recipients], title, message, payload);
  }

  private async sendPushIfSupported(
    _recipientIds: string[],
    _title: string,
    _message: string,
    _payload: Record<string, unknown>
  ): Promise<void> {
    // Placeholder: integrate push provider when User.pushToken exists
  }
}
