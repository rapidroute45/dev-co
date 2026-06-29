import { DeliveryVerification } from '../../../../shared/constants/deliveryVerification';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { resolveRouteOpsRecipientIds } from '../../../../shared/services/routeOpsRecipients.service';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import {
  emitDriverStationary,
  emitRouteUpdated,
} from '../../../chat/socket/chat.socket';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { RouteAutoCompleteService } from './routeAutoComplete.service';
import { haversineMeters } from '../utils/haversine';
import { asLocationDate } from '../utils/locationDates';
import {
  STATIONARY_DWELL_MS,
  STATIONARY_DWELL_MINUTES,
  STATIONARY_RADIUS_M,
  STOP_DWELL_MS,
  STOP_PROXIMITY_RADIUS_M,
} from '../constants/driverLocationMonitor.constants';
import type { Route } from '../../domain/entities/route.entity';

type LocationPoint = { lat: number; lng: number; recordedAt: Date };

type MonitorContext = {
  routeId: string;
  driverId: string;
  scheduleId: string;
  scheduleCity: string | null;
  driverName: string;
};

export class DriverLocationMonitorService {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private userRepo: IUserRepository,
    private routeAutoComplete: RouteAutoCompleteService,
    private notificationService: NotificationService
  ) {}

  /** Evaluate dwell / stop proximity from the latest point in each uploaded batch. */
  async processLocationBatch(
    route: Route,
    points: LocationPoint[],
    scheduleCity: string | null
  ): Promise<void> {
    if (route.status !== RouteStatus.IN_PROGRESS || !route.id || !route.driverId) return;
    if (points.length === 0) return;

    const latest = points[points.length - 1]!;
    const driver = await this.userRepo.findById(route.driverId);
    const ctx: MonitorContext = {
      routeId: route.id,
      driverId: route.driverId,
      scheduleId: route.scheduleId,
      scheduleCity,
      driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : 'Driver',
    };

    let currentRoute = route;
    currentRoute = (await this.trackStationary(currentRoute, latest, ctx)) ?? currentRoute;
    try {
      await this.trackStopProximity(currentRoute, latest, ctx);
    } catch (error) {
      console.warn('[location-monitor] stop proximity failed', {
        routeId: ctx.routeId,
        error,
      });
    }
  }

  buildDwellPayload(route: Route) {
    const startedAt = asLocationDate(route.driverDwellStartedAt);
    if (
      startedAt == null ||
      route.driverDwellAnchorLat == null ||
      route.driverDwellAnchorLng == null
    ) {
      return null;
    }

    const minutes = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60_000));

    return {
      active: true,
      minutes,
      startedAt: startedAt.toISOString(),
      thresholdMinutes: STATIONARY_DWELL_MINUTES,
      alertSent: Boolean(route.driverDwellAlertSentAt),
    };
  }

  private async trackStationary(route: Route, point: LocationPoint, ctx: MonitorContext) {
    if (!route.id) return route;

    const anchorLat = route.driverDwellAnchorLat;
    const anchorLng = route.driverDwellAnchorLng;

    if (anchorLat != null && anchorLng != null) {
      const movedMeters = haversineMeters(point.lat, point.lng, anchorLat, anchorLng);
      if (movedMeters <= STATIONARY_RADIUS_M) {
        const startedAt = asLocationDate(route.driverDwellStartedAt);
        if (startedAt && !route.driverDwellAlertSentAt) {
          const dwellMs = point.recordedAt.getTime() - startedAt.getTime();
          if (dwellMs >= STATIONARY_DWELL_MS) {
            try {
              await this.alertDriverStationary(route, point, dwellMs, ctx);
              const updated = await this.routeRepo.update(route.id, {
                driverDwellAlertSentAt: point.recordedAt,
              });
              return updated ?? route;
            } catch (error) {
              console.warn('[location-monitor] stationary alert failed', {
                routeId: ctx.routeId,
                error,
              });
            }
          }
        }
        return route;
      }
    }

    const updated = await this.routeRepo.update(route.id, {
      driverDwellAnchorLat: point.lat,
      driverDwellAnchorLng: point.lng,
      driverDwellStartedAt: point.recordedAt,
      driverDwellAlertSentAt: null,
    });
    return updated ?? route;
  }

  private async alertDriverStationary(
    route: Route,
    point: LocationPoint,
    dwellMs: number,
    ctx: MonitorContext
  ) {
    const dwellMinutes = Math.max(STATIONARY_DWELL_MINUTES, Math.floor(dwellMs / 60_000));
    const recipients = await resolveRouteOpsRecipientIds(
      this.userRepo,
      ctx.scheduleCity,
      [ctx.driverId]
    );

    emitDriverStationary({
      routeId: ctx.routeId,
      scheduleId: ctx.scheduleId,
      driverId: ctx.driverId,
      lat: point.lat,
      lng: point.lng,
      dwellMinutes,
      driverName: ctx.driverName,
    });

    if (recipients.length === 0) return;

    await this.notificationService.notifyDriverDwelling({
      recipientIds: recipients,
      routeId: ctx.routeId,
      scheduleId: ctx.scheduleId,
      driverId: ctx.driverId,
      driverName: ctx.driverName,
      dwellMinutes,
      lat: point.lat,
      lng: point.lng,
      city: ctx.scheduleCity,
    });
  }

  private async trackStopProximity(route: Route, point: LocationPoint, ctx: MonitorContext) {
    if (!route.id || route.status !== RouteStatus.IN_PROGRESS) return;

    const stops = await this.routeStopRepo.findByRouteId(route.id);
    const pendingDropoffs = stops.filter(
      (stop) => stop.type === 'dropoff' && stop.status === RouteStopStatus.PENDING
    );

    const routeStartedAt = asLocationDate(route.startedAt);

    for (const stop of pendingDropoffs) {
      const destLat = stop.destinationLat ?? stop.lat;
      const destLng = stop.destinationLng ?? stop.lng;
      if (destLat == null || destLng == null) continue;

      const distanceM = haversineMeters(point.lat, point.lng, destLat, destLng);

      if (distanceM <= STOP_PROXIMITY_RADIUS_M) {
        let enteredAt = asLocationDate(stop.proximityEnteredAt);

        if (
          enteredAt &&
          routeStartedAt &&
          enteredAt.getTime() < routeStartedAt.getTime()
        ) {
          enteredAt = null;
        }

        if (!enteredAt) {
          await this.routeStopRepo.updateById(stop.id!, {
            proximityEnteredAt: point.recordedAt,
            proximityAnchorLat: point.lat,
            proximityAnchorLng: point.lng,
          });
          continue;
        }

        const dwellMs = point.recordedAt.getTime() - enteredAt.getTime();
        if (dwellMs >= STOP_DWELL_MS && dwellMs <= 15 * 60_000) {
          await this.autoCompleteStop(route, stop.id!, ctx);
          break;
        }
        continue;
      }

      if (stop.proximityEnteredAt) {
        await this.routeStopRepo.updateById(stop.id!, {
          proximityEnteredAt: null,
          proximityAnchorLat: null,
          proximityAnchorLng: null,
        });
      }
    }
  }

  private async autoCompleteStop(route: Route, stopId: string, ctx: MonitorContext) {
    try {
      const stop = await this.routeStopRepo.findById(stopId);
      if (!stop || stop.routeId !== ctx.routeId || stop.status !== RouteStopStatus.PENDING) {
        return;
      }

      const updatedStop = await this.routeStopRepo.updateById(stopId, {
        status: RouteStopStatus.COMPLETED,
        completedAt: new Date(),
        deliveryPhotoUrl: null,
        returnReason: null,
        returnReasonCustom: null,
        proximityEnteredAt: null,
        proximityAnchorLat: null,
        proximityAnchorLng: null,
      });
      if (!updatedStop) {
        console.warn('[location-monitor] auto-complete stop update failed', {
          routeId: ctx.routeId,
          stopId,
        });
        return;
      }

      await this.routeRepo.update(ctx.routeId, {
        deliveryVerification: DeliveryVerification.PENDING,
      });

      emitRouteUpdated({
        routeId: ctx.routeId,
        scheduleId: ctx.scheduleId,
        action: 'updated',
        driverIds: [ctx.driverId],
      });

      const recipients = await resolveRouteOpsRecipientIds(
        this.userRepo,
        ctx.scheduleCity,
        [ctx.driverId]
      );
      if (recipients.length > 0) {
        await this.notificationService.notifyStopAutoCompleted({
          recipientIds: recipients,
          routeId: ctx.routeId,
          scheduleId: ctx.scheduleId,
          stopId,
          stopName: stop.name,
          driverName: ctx.driverName,
          city: ctx.scheduleCity,
        });
      }

      await this.routeAutoComplete.maybeComplete(ctx.routeId);
    } catch (error) {
      console.warn('[location-monitor] auto-complete stop failed', {
        routeId: ctx.routeId,
        stopId,
        error,
      });
    }
  }
}
