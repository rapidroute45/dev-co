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
    // Team leads receive schedule alerts instead of route_offer notifications.

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
   * In-app alerts for ops when a driver is stationary past the dwell threshold.
   * One Notification document per recipient (dispatch managers, admins, team lead).
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
    if (recipients.length === 0) {
      console.warn('[dwell-notify] No recipients after filter (driver excluded?)', {
        routeId: input.routeId,
        driverId: input.driverId,
        inputRecipientIds: input.recipientIds,
      });
      return [];
    }

    console.log('[dwell-notify] Creating in-app notifications', {
      routeId: input.routeId,
      driverName: input.driverName,
      dwellMinutes: input.dwellMinutes,
      recipients,
    });

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

    console.log('[dwell-notify] Notifications saved', {
      routeId: input.routeId,
      count: saved.length,
      notifications: saved.map((n) => ({
        id: n.id,
        recipientId: n.recipientId,
        type: n.type,
        title: n.title,
      })),
    });

    return saved;
  }

  /** Ops review GPS proof after a stop auto-completes at the delivery address. */
  async notifyStopAutoCompleted(input: {
    recipientIds: string[];
    routeId: string;
    driverId: string;
    driverName: string;
    stopId: string;
    stopName: string;
    lat: number;
    lng: number;
  }): Promise<void> {
    const recipients = [
      ...new Set(
        input.recipientIds.filter((id) => id && id !== input.driverId)
      ),
    ];
    if (recipients.length === 0) return;

    const payload = {
      routeId: input.routeId,
      driverId: input.driverId,
      driverName: input.driverName,
      stopId: input.stopId,
      stopName: input.stopName,
      lat: input.lat,
      lng: input.lng,
      deepLink: `/routes/tracking/${input.routeId}`,
      requiresVerification: true,
    };

    const title = 'Stop delivered (GPS)';
    const message = `${input.driverName} auto-completed ${input.stopName}. Verify location on the map.`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.STOP_AUTO_COMPLETED,
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
  }

  async notifyPayrollGenerated(input: {
    recipientIds: string[];
    teamId: string;
    teamName: string;
    billId: string;
    totalAmount: number;
    periodStart: string;
    periodEnd: string;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const payload = {
      teamId: input.teamId,
      teamName: input.teamName,
      billId: input.billId,
      totalAmount: input.totalAmount,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      deepLink: `/payroll/${input.billId}`,
    };
    const title = 'Payroll generated';
    const message = `${input.teamName}: ${input.periodStart} – ${input.periodEnd} · $${input.totalAmount.toFixed(2)}`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.PAYROLL_GENERATED,
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
  }

  async notifyPayrollSent(input: {
    recipientIds: string[];
    teamId: string;
    teamName: string;
    billId: string;
    totalAmount: number;
    periodStart: string;
    periodEnd: string;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const payload = {
      teamId: input.teamId,
      teamName: input.teamName,
      billId: input.billId,
      totalAmount: input.totalAmount,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      deepLink: `/payroll/${input.billId}`,
    };
    const title = 'Payroll sent for review';
    const message = `Review payroll for ${input.teamName} (${input.periodStart} – ${input.periodEnd}).`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.PAYROLL_SENT,
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
  }

  async notifyPayrollApproved(input: {
    recipientIds: string[];
    teamId: string;
    teamName: string;
    billId: string;
    totalAmount: number;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const payload = {
      teamId: input.teamId,
      teamName: input.teamName,
      billId: input.billId,
      totalAmount: input.totalAmount,
      deepLink: `/payroll/${input.billId}`,
    };
    const title = 'Payroll approved';
    const message = `${input.teamName} payroll approved · $${input.totalAmount.toFixed(2)} ready for payment.`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.PAYROLL_APPROVED,
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
  }

  async notifyRouteOpsTeamVerified(input: {
    recipientIds: string[];
    routeId: string;
    scheduleId: string;
    storeName: string;
    city: string;
    teamName: string;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const payload = {
      routeId: input.routeId,
      scheduleId: input.scheduleId,
      storeName: input.storeName,
      city: input.city,
      teamName: input.teamName,
      deepLink: `/schedules/${input.scheduleId}`,
    };
    const title = 'Route ready for manager review';
    const message = `${input.teamName} verified a completed route for ${input.storeName} (${input.city}).`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.ROUTE_OPS_REVIEW,
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
