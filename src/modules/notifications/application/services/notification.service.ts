import {
  Notification,
  NotificationType,
} from '../../domain/entities/notification.entity';
import { IDeviceTokenRepository } from '../../domain/interfaces/device-token-repository.interface';
import { INotificationRepository } from '../../domain/interfaces/notification-repository.interface';
import { DeviceTokenRepository } from '../../infrastructure/repositories/deviceToken.repository';
import { PushMessagingService } from '../../infrastructure/push/pushMessaging.service';

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
  private pushService: PushMessagingService;

  constructor(
    private notificationRepo: INotificationRepository,
    deviceTokenRepo: IDeviceTokenRepository = new DeviceTokenRepository()
  ) {
    this.pushService = new PushMessagingService(deviceTokenRepo);
  }

  /**
   * Persists in-app notifications and sends FCM push when device tokens exist.
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
      deepLink: '/route-offers',
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

    void this.sendPushIfSupported(
      [...recipients],
      title,
      message,
      payload,
      NotificationType.ROUTE_OFFER
    );
  }

  /** Team lead alert when dispatch creates a route without a driver. */
  async notifyRouteNeedsDriver(input: {
    teamLeadId: string;
    scheduleDate: string;
    storeName: string;
    city: string;
    state: string;
    arrivalTime: string;
    departureTime: string;
    teamName: string;
    routeId: string;
    scheduleId: string;
  }): Promise<void> {
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
      deepLink: `/schedules/${input.scheduleId}`,
    };

    const title = 'Route needs a driver';
    const message = `${input.storeName} (${input.city}, ${input.state}) — ${input.arrivalTime} to ${input.departureTime}. Assign a driver in the app.`;
    const recipients = [input.teamLeadId];

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.ROUTE_NEEDS_DRIVER,
            title,
            message,
            payload,
            read: false,
            pushSent: false,
          })
        )
      )
    );

    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.ROUTE_NEEDS_DRIVER
    );
  }

  /** Ops alert when a team lead assigns a driver to a route. */
  async notifyRouteDriverAssignedToOps(input: {
    recipientIds: string[];
    driverId: string;
    driverName: string;
    scheduleDate: string;
    storeName: string;
    city: string;
    state: string;
    arrivalTime: string;
    departureTime: string;
    teamName: string;
    routeId: string;
    scheduleId: string;
  }): Promise<void> {
    const recipients = [
      ...new Set(
        input.recipientIds.filter((id) => id && id !== input.driverId)
      ),
    ];
    if (recipients.length === 0) return;

    const payload = {
      routeId: input.routeId,
      scheduleId: input.scheduleId,
      scheduleDate: input.scheduleDate,
      driverId: input.driverId,
      driverName: input.driverName,
      storeName: input.storeName,
      city: input.city,
      state: input.state,
      arrivalTime: input.arrivalTime,
      departureTime: input.departureTime,
      teamName: input.teamName,
      deepLink: `/schedules/${input.scheduleId}`,
    };

    const title = 'Driver assigned to route';
    const message = `${input.teamName}: ${input.driverName} assigned to ${input.storeName} (${input.scheduleDate}) — ${input.arrivalTime} to ${input.departureTime}`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.ROUTE_ASSIGNED,
            title,
            message,
            payload,
            read: false,
            pushSent: false,
          })
        )
      )
    );

    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.ROUTE_ASSIGNED
    );
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
    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.PAYROLL_GENERATED
    );
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
    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.PAYROLL_SENT
    );
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
    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.PAYROLL_APPROVED
    );
  }

  async notifyScheduleCreated(input: {
    recipientIds: string[];
    scheduleId: string;
    storeName: string;
    city: string;
    state: string;
    scheduleDate: string;
    actorName: string;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const payload = {
      scheduleId: input.scheduleId,
      storeName: input.storeName,
      city: input.city,
      state: input.state,
      scheduleDate: input.scheduleDate,
      actorName: input.actorName,
      deepLink: `/schedules/${input.scheduleId}`,
    };
    const title = 'Schedule created';
    const message = `${input.actorName} created a schedule for ${input.storeName} (${input.city}, ${input.scheduleDate}).`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.SCHEDULE_CREATED,
            title,
            message,
            payload,
            read: false,
            pushSent: false,
          })
        )
      )
    );
    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.SCHEDULE_CREATED
    );
  }

  async notifyScheduleUpdated(input: {
    recipientIds: string[];
    scheduleId: string;
    storeName: string;
    city: string;
    state: string;
    scheduleDate: string;
    actorName: string;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const payload = {
      scheduleId: input.scheduleId,
      storeName: input.storeName,
      city: input.city,
      state: input.state,
      scheduleDate: input.scheduleDate,
      actorName: input.actorName,
      deepLink: `/schedules/${input.scheduleId}`,
    };
    const title = 'Schedule updated';
    const message = `${input.actorName} updated the schedule for ${input.storeName} (${input.city}, ${input.scheduleDate}).`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.SCHEDULE_UPDATED,
            title,
            message,
            payload,
            read: false,
            pushSent: false,
          })
        )
      )
    );
    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.SCHEDULE_UPDATED
    );
  }

  async notifyRouteCreatedByDispatchTeam(input: {
    recipientIds: string[];
    routeId: string;
    scheduleId: string;
    routeName: string | null;
    storeName: string;
    city: string;
    state: string;
    scheduleDate: string;
    teamName: string;
    actorName: string;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const routeLabel = input.routeName?.trim() || 'Route';
    const payload = {
      routeId: input.routeId,
      scheduleId: input.scheduleId,
      routeName: routeLabel,
      storeName: input.storeName,
      city: input.city,
      state: input.state,
      scheduleDate: input.scheduleDate,
      teamName: input.teamName,
      actorName: input.actorName,
      deepLink: `/schedules/${input.scheduleId}`,
    };
    const title = 'Route added';
    const message = `${input.actorName} added ${routeLabel} for ${input.teamName} on ${input.storeName} (${input.scheduleDate}).`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.ROUTE_CREATED,
            title,
            message,
            payload,
            read: false,
            pushSent: false,
          })
        )
      )
    );
    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.ROUTE_CREATED
    );
  }

  /** Team lead in-app + push alert when dispatch changes routes on a schedule. */
  async notifyTeamLeadScheduleAlert(input: {
    teamLeadId: string;
    scheduleId: string;
    teamId: string;
    scheduleDate: string;
    city: string;
    state: string;
    storeName: string;
    routeCount: number;
    assignedRouteCount: number;
    updateType: 'schedule_updated' | 'route_deleted';
    deletedRouteName?: string | null;
  }): Promise<void> {
    if (!input.teamLeadId) return;

    const routeLabel =
      input.routeCount === 1 ? '1 route' : `${input.routeCount} routes`;
    const location = `${input.city}, ${input.state} (${input.storeName})`;

    let title: string;
    let message: string;

    if (input.updateType === 'route_deleted') {
      const deletedName = input.deletedRouteName?.trim() || 'A route';
      const remaining =
        input.routeCount === 0
          ? 'No routes remain on this schedule for your team.'
          : `${routeLabel} remain on this schedule for your team.`;
      title = 'Route deleted by dispatch';
      message = `${deletedName} was deleted by dispatch from the schedule for ${input.scheduleDate} in ${location}. ${remaining}`;
    } else {
      const unassigned = input.routeCount - input.assignedRouteCount;
      let assignHint = 'Please assign drivers on those routes.';
      if (unassigned <= 0) {
        assignHint = 'All routes have drivers assigned. Review the schedule when ready.';
      } else if (unassigned === 1) {
        assignHint = 'Please assign a driver on the remaining route.';
      } else {
        assignHint = `Please assign drivers on ${unassigned} remaining routes.`;
      }
      title = 'Schedule updated by dispatch';
      message = `Schedule for ${input.scheduleDate} updated by dispatch team with ${routeLabel} in ${location}. ${assignHint}`;
    }

    const payload = {
      scheduleId: input.scheduleId,
      teamId: input.teamId,
      scheduleDate: input.scheduleDate,
      storeName: input.storeName,
      city: input.city,
      state: input.state,
      routeCount: input.routeCount,
      assignedRouteCount: input.assignedRouteCount,
      updateType: input.updateType,
      deepLink: `/schedules/${input.scheduleId}`,
    };

    const type =
      input.updateType === 'route_deleted'
        ? NotificationType.ROUTE_UPDATED
        : NotificationType.SCHEDULE_UPDATED;

    await this.notificationRepo.save(
      new Notification({
        recipientId: input.teamLeadId,
        type,
        title,
        message,
        payload,
        read: false,
        pushSent: false,
      })
    );
    void this.sendPushIfSupported(
      [input.teamLeadId],
      title,
      message,
      payload,
      type
    );
  }

  async notifyRouteUpdatedByDispatchTeam(input: {
    recipientIds: string[];
    routeId: string;
    scheduleId: string;
    routeName: string | null;
    storeName: string;
    city: string;
    state: string;
    scheduleDate: string;
    teamName: string;
    actorName: string;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const routeLabel = input.routeName?.trim() || 'Route';
    const payload = {
      routeId: input.routeId,
      scheduleId: input.scheduleId,
      routeName: routeLabel,
      storeName: input.storeName,
      city: input.city,
      state: input.state,
      scheduleDate: input.scheduleDate,
      teamName: input.teamName,
      actorName: input.actorName,
      deepLink: `/schedules/${input.scheduleId}`,
    };
    const title = 'Route updated';
    const message = `${input.actorName} updated ${routeLabel} for ${input.teamName} on ${input.storeName} (${input.scheduleDate}).`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.ROUTE_UPDATED,
            title,
            message,
            payload,
            read: false,
            pushSent: false,
          })
        )
      )
    );
    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.ROUTE_UPDATED
    );
  }

  async notifyDispatchTeamUpdated(input: {
    recipientId: string;
    userId: string;
    actorName: string;
    summary: string;
  }): Promise<void> {
    if (!input.recipientId) return;

    const payload = {
      userId: input.userId,
      actorName: input.actorName,
      deepLink: `/dispatch-team/${input.userId}`,
    };
    const title = 'Your dispatch profile was updated';
    const message = `${input.actorName}: ${input.summary}`;

    await this.notificationRepo.save(
      new Notification({
        recipientId: input.recipientId,
        type: NotificationType.DISPATCH_TEAM_UPDATED,
        title,
        message,
        payload,
        read: false,
        pushSent: false,
      })
    );
    void this.sendPushIfSupported(
      [input.recipientId],
      title,
      message,
      payload,
      NotificationType.DISPATCH_TEAM_UPDATED
    );
  }

  async notifyDocumentVerified(input: {
    recipientId: string;
    requirementId: string;
  }): Promise<void> {
    const payload = { requirementId: input.requirementId, deepLink: '/documents' };
    const title = 'Document verified';
    const message = 'A document was approved by dispatch.';
    await this.notificationRepo.save(
      new Notification({
        recipientId: input.recipientId,
        type: NotificationType.DOCUMENT_VERIFIED,
        title,
        message,
        payload,
        read: false,
        pushSent: false,
      })
    );
    void this.sendPushIfSupported(
      [input.recipientId],
      title,
      message,
      payload,
      NotificationType.DOCUMENT_VERIFIED
    );
  }

  async notifyDocumentRejected(input: {
    recipientId: string;
    requirementId: string;
    reason: string;
  }): Promise<void> {
    const payload = { requirementId: input.requirementId, deepLink: '/documents' };
    const title = 'Document needs attention';
    const message = input.reason;
    await this.notificationRepo.save(
      new Notification({
        recipientId: input.recipientId,
        type: NotificationType.DOCUMENT_REJECTED,
        title,
        message,
        payload,
        read: false,
        pushSent: false,
      })
    );
    void this.sendPushIfSupported(
      [input.recipientId],
      title,
      message,
      payload,
      NotificationType.DOCUMENT_REJECTED
    );
  }

  async notifyDocumentRequiredBatch(input: {
    recipientIds: string[];
    requirementId: string;
    requirementTitle: string;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const payload = { requirementId: input.requirementId, deepLink: '/documents' };
    const title = 'New document required';
    const message = `Please upload: ${input.requirementTitle}`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.DOCUMENT_REQUIRED,
            title,
            message,
            payload,
            read: false,
            pushSent: false,
          })
        )
      )
    );
    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.DOCUMENT_REQUIRED
    );
  }

  async notifyDocumentUpdatedBatch(input: {
    recipientIds: string[];
    requirementId: string;
    requirementTitle: string;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const payload = { requirementId: input.requirementId, deepLink: '/documents' };
    const title = 'Document requirement updated';
    const message = `Please review: ${input.requirementTitle}`;

    await Promise.all(
      recipients.map((recipientId) =>
        this.notificationRepo.save(
          new Notification({
            recipientId,
            type: NotificationType.DOCUMENT_UPDATED,
            title,
            message,
            payload,
            read: false,
            pushSent: false,
          })
        )
      )
    );
    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.DOCUMENT_UPDATED
    );
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
    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.ROUTE_OPS_REVIEW
    );
  }

  async notifyDriverDwelling(input: {
    recipientIds: string[];
    routeId: string;
    scheduleId: string;
    driverId: string;
    driverName: string;
    dwellMinutes: number;
    lat: number;
    lng: number;
    city?: string | null;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const payload = {
      routeId: input.routeId,
      scheduleId: input.scheduleId,
      driverId: input.driverId,
      driverName: input.driverName,
      dwellMinutes: input.dwellMinutes,
      lat: input.lat,
      lng: input.lng,
      city: input.city ?? null,
      deepLink: `/routes/tracking/${input.routeId}`,
    };
    const title = 'Driver not moving';
    const message = `${input.driverName} has been at the same location for ${input.dwellMinutes}+ minutes.`;

    await Promise.all(
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

    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.DRIVER_DWELLING
    );
  }

  async notifyStopAutoCompleted(input: {
    recipientIds: string[];
    routeId: string;
    scheduleId: string;
    stopId: string;
    stopName: string;
    driverName: string;
    city?: string | null;
  }): Promise<void> {
    const recipients = [...new Set(input.recipientIds.filter(Boolean))];
    if (recipients.length === 0) return;

    const payload = {
      routeId: input.routeId,
      scheduleId: input.scheduleId,
      stopId: input.stopId,
      stopName: input.stopName,
      driverName: input.driverName,
      city: input.city ?? null,
      deepLink: `/routes/tracking/${input.routeId}`,
    };
    const title = 'Stop auto-completed';
    const message = `${input.stopName} was auto-completed for ${input.driverName} after 2+ minutes on site.`;

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

    void this.sendPushIfSupported(
      recipients,
      title,
      message,
      payload,
      NotificationType.STOP_AUTO_COMPLETED
    );
  }

  private async sendPushIfSupported(
    recipientIds: string[],
    title: string,
    message: string,
    payload: Record<string, unknown>,
    type: NotificationType
  ): Promise<void> {
    try {
      const result = await this.pushService.sendToRecipients({
        recipientIds,
        title,
        body: message,
        type,
        payload,
      });

      if (result.sent > 0) {
        await this.notificationRepo.markPushSentForRecipients(recipientIds, type);
      }
    } catch (error) {
      console.error('[push] sendPushIfSupported failed', {
        type,
        recipientCount: recipientIds.length,
        error,
      });
    }
  }
}
