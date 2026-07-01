import { resolveRouteOpsRecipientIds } from '../../../../shared/services/routeOpsRecipients.service';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import {
  emitDriverBreakEnded,
  emitDriverBreakMovement,
  emitDriverBreakStarted,
} from '../../../chat/socket/chat.socket';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import type { Route } from '../../domain/entities/route.entity';
import {
  clearDriverBreakFields,
  type DriverBreakEndReason,
} from '../utils/driverBreak.utils';
import { asLocationDate } from '../utils/locationDates';

type BreakContext = {
  routeId: string;
  scheduleId: string;
  driverId: string;
  scheduleCity: string | null;
  driverName: string;
};

export class DriverBreakService {
  constructor(
    private routeRepo: IRouteRepository,
    private userRepo: IUserRepository,
    private notificationService: NotificationService
  ) {}

  async resolveContext(route: Route, scheduleCity: string | null): Promise<BreakContext | null> {
    if (!route.id || !route.driverId) return null;

    const driver = await this.userRepo.findById(route.driverId);
    return {
      routeId: route.id,
      scheduleId: route.scheduleId,
      driverId: route.driverId,
      scheduleCity,
      driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : 'Driver',
    };
  }

  async notifyBreakStarted(
    route: Route,
    scheduleCity: string | null,
    durationMinutes: number
  ): Promise<void> {
    const ctx = await this.resolveContext(route, scheduleCity);
    if (!ctx) return;

    const lat = route.driverBreakAnchorLat ?? route.driverLat;
    const lng = route.driverBreakAnchorLng ?? route.driverLng;

    const startedAt = asLocationDate(route.driverBreakStartedAt);
    const endsAt = asLocationDate(route.driverBreakEndsAt);

    emitDriverBreakStarted({
      routeId: ctx.routeId,
      scheduleId: ctx.scheduleId,
      driverId: ctx.driverId,
      driverName: ctx.driverName,
      durationMinutes,
      startedAt: startedAt?.toISOString() ?? new Date().toISOString(),
      endsAt: endsAt?.toISOString() ?? new Date().toISOString(),
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    });

    const recipients = await resolveRouteOpsRecipientIds(
      this.userRepo,
      ctx.scheduleCity,
      [ctx.driverId]
    );
    if (recipients.length === 0) return;

    await this.notificationService.notifyDriverBreakStarted({
      recipientIds: recipients,
      routeId: ctx.routeId,
      scheduleId: ctx.scheduleId,
      driverId: ctx.driverId,
      driverName: ctx.driverName,
      durationMinutes,
      lat: lat ?? null,
      lng: lng ?? null,
      city: ctx.scheduleCity,
    });
  }

  async notifyBreakMovement(
    route: Route,
    scheduleCity: string | null,
    lat: number,
    lng: number
  ): Promise<void> {
    const ctx = await this.resolveContext(route, scheduleCity);
    if (!ctx || !route.id) return;

    emitDriverBreakMovement({
      routeId: ctx.routeId,
      scheduleId: ctx.scheduleId,
      driverId: ctx.driverId,
      driverName: ctx.driverName,
      lat,
      lng,
    });

    const recipients = await resolveRouteOpsRecipientIds(
      this.userRepo,
      ctx.scheduleCity,
      [ctx.driverId]
    );
    if (recipients.length === 0) return;

    await this.notificationService.notifyDriverBreakMovement({
      recipientIds: recipients,
      routeId: ctx.routeId,
      scheduleId: ctx.scheduleId,
      driverId: ctx.driverId,
      driverName: ctx.driverName,
      lat,
      lng,
      city: ctx.scheduleCity,
    });

    await this.routeRepo.update(route.id, {
      driverBreakMovementAlertSentAt: new Date(),
    });
  }

  async endBreak(
    route: Route,
    reason: DriverBreakEndReason,
    scheduleCity: string | null
  ): Promise<Route | null> {
    if (!route.id) return null;

    const ctx = await this.resolveContext(route, scheduleCity);
    const lat = route.driverLat;
    const lng = route.driverLng;

    const updated =
      (await this.routeRepo.update(route.id, clearDriverBreakFields())) ?? route;

    if (ctx) {
      emitDriverBreakEnded({
        routeId: ctx.routeId,
        scheduleId: ctx.scheduleId,
        driverId: ctx.driverId,
        driverName: ctx.driverName,
        reason,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
      });

      const recipients = await resolveRouteOpsRecipientIds(
        this.userRepo,
        ctx.scheduleCity,
        [ctx.driverId]
      );
      if (recipients.length > 0) {
        await this.notificationService.notifyDriverBreakEnded({
          recipientIds: recipients,
          routeId: ctx.routeId,
          scheduleId: ctx.scheduleId,
          driverId: ctx.driverId,
          driverName: ctx.driverName,
          reason,
          lat: lat ?? null,
          lng: lng ?? null,
          city: ctx.scheduleCity,
        });
      }
    }

    return updated;
  }
}
