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

  /**
   * In-app alerts for ops when a driver is stationary 20+ minutes (push in a later phase).
   * One Notification document per recipient (team lead, dispatch managers, admins).
   */
  async notifyDriverDwelling(input: {
    recipientIds: string[];
    routeId: string;
    driverId: string;
    driverName: string;
    dwellSessionId: string;
    centerLat: number;
    centerLng: number;
    dwellMinutes: number;
    startedAt: string;
  }): Promise<Notification[]> {
    const payload = {
      routeId: input.routeId,
      driverId: input.driverId,
      driverName: input.driverName,
      dwellSessionId: input.dwellSessionId,
      centerLat: input.centerLat,
      centerLng: input.centerLng,
      dwellMinutes: input.dwellMinutes,
      startedAt: input.startedAt,
      deepLink: `/routes/tracking/${input.routeId}`,
    };

    const title = 'Driver stationary on route';
    const message = `${input.driverName} has been at the same location for ${input.dwellMinutes}+ minutes.`;

    const recipients = [
      ...new Set(
        input.recipientIds.filter((id) => id && id !== input.driverId)
      ),
    ];
    if (recipients.length === 0) return [];

    const saved = await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.DRIVER_DWELLING,
            title,
            message,
            payload,
            read: false,
            pushSent: false,
          })
        )
      )
    );

    void this.sendPushIfSupported(recipients, title, message, payload);

    return saved;
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
