import { DeliveryVerification } from '../../../../shared/constants/deliveryVerification';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { resolveRouteOpsRecipientIds } from '../../../../shared/services/routeOpsRecipients.service';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import {
  emitDriverOffRoute,
  emitDispatchAlert,
  emitRouteUpdated,
} from '../../../chat/socket/chat.socket';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { RouteAutoCompleteService } from './routeAutoComplete.service';
import { DriverBreakService } from './driverBreak.service';
import { findStopDwellFromBatch, batchPointsForDwellWindow } from '../utils/batchStopDwell';
import { isStationarySpeed, readRawCoords } from '../utils/batchLocationMetrics';
import { isNearAnyPendingStop } from '../utils/stopGeofence';
import { distanceToPolylineM } from '../utils/distanceToPolyline';
import { haversineMeters } from '../utils/haversine';
import { readStopDestinationCoords } from '../utils/stopDestinationCoords';
import { asLocationDate } from '../utils/locationDates';
import {
  buildBreakPayload,
  isDriverBreakActive,
} from '../utils/driverBreak.utils';
import {
  AUTO_COMPLETE_MAX_SPEED_MPS,
  AUTO_COMPLETE_PROXIMITY_RADIUS_M,
  OFF_ROUTE_THRESHOLD_M,
  STATIONARY_DWELL_MS,
  STATIONARY_DWELL_MINUTES,
  STATIONARY_RADIUS_M,
  STOP_DWELL_MS,
} from '../constants/driverLocationMonitor.constants';
import type { Route } from '../../domain/entities/route.entity';

type LocationPoint = { lat: number; lng: number; rawLat?: number; rawLng?: number; recordedAt: Date };

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
    private notificationService: NotificationService,
    private driverBreakService: DriverBreakService
  ) {}

  /** Evaluate dwell / stop proximity from uploaded batch (full scan + latest point). */
  async processLocationBatch(
    route: Route,
    points: LocationPoint[],
    scheduleCity: string | null,
    options?: { offRoute?: boolean }
  ): Promise<void> {
    if (route.status !== RouteStatus.IN_PROGRESS || !route.id || !route.driverId) return;
    if (points.length === 0) return;

    const driver = await this.userRepo.findById(route.driverId);
    const ctx: MonitorContext = {
      routeId: route.id,
      driverId: route.driverId,
      scheduleId: route.scheduleId,
      scheduleCity,
      driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : 'Driver',
    };

    let currentRoute = route;
    const latest = points[points.length - 1]!;

    currentRoute =
      (await this.processActiveBreak(currentRoute, latest, ctx, scheduleCity)) ?? currentRoute;

    if (isDriverBreakActive(currentRoute)) {
      return;
    }

    currentRoute = (await this.trackStationary(currentRoute, latest, points, ctx)) ?? currentRoute;

    try {
      await this.scanBatchForStopDwell(currentRoute, points, ctx);
    } catch (error) {
      console.warn('[location-monitor] batch dwell scan failed', { routeId: ctx.routeId, error });
    }

    try {
      await this.trackStopProximity(currentRoute, latest, points, ctx);
    } catch (error) {
      console.warn('[location-monitor] stop proximity failed', {
        routeId: ctx.routeId,
        error,
      });
    }

    try {
      currentRoute =
        (await this.trackOffRoute(currentRoute, latest, ctx, options?.offRoute)) ?? currentRoute;
    } catch (error) {
      console.warn('[location-monitor] off-route tracking failed', {
        routeId: ctx.routeId,
        error,
      });
    }
  }

  /** Retroactive auto-complete from full batch timestamps (offline sync). */
  private async scanBatchForStopDwell(
    route: Route,
    points: LocationPoint[],
    ctx: MonitorContext
  ) {
    if (!route.id || route.status !== RouteStatus.IN_PROGRESS) return;

    const stops = await this.routeStopRepo.findByRouteId(route.id);
    const pendingDropoffs = stops.filter(
      (stop) => stop.type === 'dropoff' && stop.status === RouteStopStatus.PENDING
    );

    for (const stop of pendingDropoffs) {
      const dest = readStopDestinationCoords(stop);
      if (!dest || !stop.id) continue;

      const match = findStopDwellFromBatch(points, dest);
      if (match) {
        await this.autoCompleteStop(route, stop.id, ctx);
        break;
      }
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

  buildBreakPayload(route: Route) {
    return buildBreakPayload(route);
  }

  private async processActiveBreak(
    route: Route,
    point: LocationPoint,
    ctx: MonitorContext,
    scheduleCity: string | null
  ): Promise<Route | null> {
    if (!route.id || !isDriverBreakActive(route)) return route;

    const endsAt = asLocationDate(route.driverBreakEndsAt);
    if (endsAt && Date.now() >= endsAt.getTime()) {
      return this.driverBreakService.endBreak(route, 'timer', scheduleCity);
    }

    const anchorLat = route.driverBreakAnchorLat;
    const anchorLng = route.driverBreakAnchorLng;
    if (anchorLat == null || anchorLng == null) return route;

    const movedMeters = haversineMeters(point.lat, point.lng, anchorLat, anchorLng);
    if (movedMeters <= STATIONARY_RADIUS_M) return route;

    if (!route.driverBreakMovementAlertSentAt) {
      try {
        await this.driverBreakService.notifyBreakMovement(
          route,
          scheduleCity,
          point.lat,
          point.lng
        );
      } catch (error) {
        console.warn('[location-monitor] break movement alert failed', {
          routeId: ctx.routeId,
          error,
        });
      }
    }

    try {
      return this.driverBreakService.endBreak(route, 'movement', scheduleCity);
    } catch (error) {
      console.warn('[location-monitor] break end on movement failed', {
        routeId: ctx.routeId,
        error,
      });
      return route;
    }
  }

  private async trackStationary(
    route: Route,
    point: LocationPoint,
    batchPoints: LocationPoint[],
    ctx: MonitorContext
  ) {
    if (!route.id) return route;

    const stops = await this.routeStopRepo.findByRouteId(route.id);
    const pendingDropoffs = stops.filter(
      (stop) => stop.type === 'dropoff' && stop.status === RouteStopStatus.PENDING
    );

    if (isNearAnyPendingStop(point, pendingDropoffs, AUTO_COMPLETE_PROXIMITY_RADIUS_M)) {
      if (route.driverDwellAnchorLat != null || route.driverDwellStartedAt != null) {
        const cleared = await this.routeRepo.update(route.id, {
          driverDwellAnchorLat: null,
          driverDwellAnchorLng: null,
          driverDwellStartedAt: null,
          driverDwellAlertSentAt: null,
        });
        return cleared ?? route;
      }
      return route;
    }

    const raw = readRawCoords(point);
    const anchorLat = route.driverDwellAnchorLat;
    const anchorLng = route.driverDwellAnchorLng;

    if (anchorLat != null && anchorLng != null) {
      const movedMeters = haversineMeters(raw.lat, raw.lng, anchorLat, anchorLng);
      if (movedMeters <= STATIONARY_RADIUS_M) {
        const startedAt = asLocationDate(route.driverDwellStartedAt);
        if (startedAt && !route.driverDwellAlertSentAt) {
          const dwellMs = point.recordedAt.getTime() - startedAt.getTime();
          if (
            dwellMs >= STATIONARY_DWELL_MS &&
            isStationarySpeed(batchPointsForDwellWindow(batchPoints, startedAt, point.recordedAt))
          ) {
            try {
              await this.alertDriverStationaryOutsideStop(route, point, dwellMs, ctx);
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
      driverDwellAnchorLat: raw.lat,
      driverDwellAnchorLng: raw.lng,
      driverDwellStartedAt: point.recordedAt,
      driverDwellAlertSentAt: null,
    });
    return updated ?? route;
  }

  private async alertDriverStationaryOutsideStop(
    route: Route,
    point: LocationPoint,
    dwellMs: number,
    ctx: MonitorContext
  ) {
    const dwellMinutes = Math.max(STATIONARY_DWELL_MINUTES, Math.floor(dwellMs / 60_000));
    const raw = readRawCoords(point);
    const recipients = await resolveRouteOpsRecipientIds(
      this.userRepo,
      ctx.scheduleCity,
      [ctx.driverId]
    );

    emitDispatchAlert({
      kind: 'driver_stationary_outside_stop',
      routeId: ctx.routeId,
      scheduleId: ctx.scheduleId,
      driverId: ctx.driverId,
      lat: raw.lat,
      lng: raw.lng,
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
      lat: raw.lat,
      lng: raw.lng,
      city: ctx.scheduleCity,
    });
  }

  private async trackStopProximity(
    route: Route,
    point: LocationPoint,
    batchPoints: LocationPoint[],
    ctx: MonitorContext
  ) {
    if (!route.id || route.status !== RouteStatus.IN_PROGRESS) return;

    const stops = await this.routeStopRepo.findByRouteId(route.id);
    const pendingDropoffs = stops.filter(
      (stop) => stop.type === 'dropoff' && stop.status === RouteStopStatus.PENDING
    );

    const routeStartedAt = asLocationDate(route.startedAt);
    const raw = readRawCoords(point);

    for (const stop of pendingDropoffs) {
      const dest = readStopDestinationCoords(stop);
      if (!dest) continue;

      const distanceM = haversineMeters(raw.lat, raw.lng, dest.lat, dest.lng);

      if (distanceM <= AUTO_COMPLETE_PROXIMITY_RADIUS_M) {
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
            proximityAnchorLat: raw.lat,
            proximityAnchorLng: raw.lng,
          });
          continue;
        }

        const dwellMs = point.recordedAt.getTime() - enteredAt.getTime();
        const dwellWindowPoints = batchPointsForDwellWindow(batchPoints, enteredAt, point.recordedAt);
        const speedOk = isStationarySpeed(dwellWindowPoints, AUTO_COMPLETE_MAX_SPEED_MPS);

        if (dwellMs >= STOP_DWELL_MS && dwellMs <= 15 * 60_000 && speedOk) {
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

  private isPointOffRoute(
    route: Route,
    point: LocationPoint,
    mobileOffRoute?: boolean
  ): boolean {
    if (mobileOffRoute) return true;

    const polyline = route.driverActiveSegmentPolyline ?? [];
    if (polyline.length < 2) return false;

    const rawLat = point.rawLat ?? point.lat;
    const rawLng = point.rawLng ?? point.lng;
    const distanceM = distanceToPolylineM({ lat: rawLat, lng: rawLng }, polyline);
    return distanceM > OFF_ROUTE_THRESHOLD_M;
  }

  private async trackOffRoute(
    route: Route,
    point: LocationPoint,
    ctx: MonitorContext,
    mobileOffRoute?: boolean
  ) {
    if (!route.id) return route;

    const offRoute = this.isPointOffRoute(route, point, mobileOffRoute);

    if (offRoute) {
      if (route.driverOffRouteAlertSentAt) return route;

      const recipients = await resolveRouteOpsRecipientIds(
        this.userRepo,
        ctx.scheduleCity,
        [ctx.driverId]
      );

      emitDriverOffRoute({
        routeId: ctx.routeId,
        scheduleId: ctx.scheduleId,
        driverId: ctx.driverId,
        lat: point.lat,
        lng: point.lng,
        driverName: ctx.driverName,
      });

      if (recipients.length > 0) {
        await this.notificationService.notifyDriverOffRoute({
          recipientIds: recipients,
          routeId: ctx.routeId,
          scheduleId: ctx.scheduleId,
          driverId: ctx.driverId,
          driverName: ctx.driverName,
          lat: point.lat,
          lng: point.lng,
          city: ctx.scheduleCity,
        });
      }

      return (
        (await this.routeRepo.update(route.id, {
          driverOffRouteAlertSentAt: point.recordedAt,
        })) ?? route
      );
    }

    if (route.driverOffRouteAlertSentAt) {
      return (
        (await this.routeRepo.update(route.id, {
          driverOffRouteAlertSentAt: null,
        })) ?? route
      );
    }

    return route;
  }

  async notifyManualStopCompleted(
    route: Route,
    stop: { id: string; name: string },
    scheduleCity: string | null
  ) {
    if (!route.id || !route.driverId) return;

    const driver = await this.userRepo.findById(route.driverId);
    const driverName = driver ? resolveDisplayName(driver.fullName, driver.email) : 'Driver';
    const recipients = await resolveRouteOpsRecipientIds(
      this.userRepo,
      scheduleCity,
      [route.driverId]
    );

    if (recipients.length === 0) return;

    await this.notificationService.notifyStopCompleted({
      recipientIds: recipients,
      routeId: route.id,
      scheduleId: route.scheduleId,
      stopId: stop.id,
      stopName: stop.name,
      driverName,
      city: scheduleCity,
    });
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
