import { AppError } from '../../../../shared/errors/app-error';
import {
  RETURN_REASON_PRESETS,
  RouteStopStatus,
} from '../../../../shared/constants/routeStopStatuses';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { DeliveryVerification } from '../../../../shared/constants/deliveryVerification';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { AddressAccessCodeRepository } from '../../infrastructure/repositories/addressAccessCode.repository';
import { DriverLocationRepository } from '../../infrastructure/repositories/driverLocation.repository';
import { geocodeMissingRouteStops } from '../services/routeStopGeo.service';
import { scheduleGeocodeContext } from '../utils/geocodeContext';
import { mapStopsToResponse } from '../utils/routeStops';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { DwellDetectionService } from '../services/dwellDetection.service';
import { StopProximityService } from '../services/stopProximity.service';
import { RouteAutoCompleteService } from '../services/routeAutoComplete.service';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { UserRole } from '../../../../shared/constants/roles';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';
import { emitDriverLocationUpdated, emitRouteUpdated } from '../../../chat/socket/chat.socket';
import { resolveDisplayName } from '../../../../shared/utils/displayName';

export class RouteDeliveryUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private driverLocationRepo: DriverLocationRepository,
    private addressCodeRepo: AddressAccessCodeRepository,
    private routeStopEnrichment: RouteStopEnrichmentService,
    private dwellDetection: DwellDetectionService,
    private stopProximity: StopProximityService,
    private routeAutoComplete: RouteAutoCompleteService,
    private notificationService: NotificationService,
    private userRepo: IUserRepository,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository
  ) {}

  private assertTrackingViewer(actor?: {
    role: UserRole | null;
    assignedCity?: string | null;
    assignedCities?: string[] | null;
  }) {
    if (
      actor?.role !== UserRole.ADMIN &&
      actor?.role !== UserRole.DISPATCH_MANAGER &&
      actor?.role !== UserRole.DISPATCH_TEAM
    ) {
      throw new AppError('Access denied.', 403);
    }
  }

  private async publishDriverLocation(params: {
    route: NonNullable<Awaited<ReturnType<IRouteRepository['findById']>>>;
    driverId: string;
    lat: number;
    lng: number;
    recordedAt: Date;
    autoCompletedStops?: { stopId: string; stopName: string }[];
    routeCompleted?: boolean;
    dwell?: {
      active: boolean;
      minutes: number;
      alertSent: boolean;
      sessionId: string | null;
      startedAt?: string | null;
    };
  }) {
    const schedule = await this.scheduleRepo.findById(params.route.scheduleId);
    if (!schedule) return;

    const store = await this.storeRepo.findById(schedule.storeId);
    const driver = await this.userRepo.findById(params.driverId);
    const stops = await this.routeStopRepo.findByRouteId(params.route.id!);
    const mapped = mapStopsToResponse(stops);

    emitDriverLocationUpdated({
      routeId: params.route.id!,
      scheduleId: params.route.scheduleId,
      driverId: params.driverId,
      driverName: driver
        ? resolveDisplayName(driver.fullName, driver.email)
        : 'Driver',
      routeName: params.route.routeName,
      lat: params.lat,
      lng: params.lng,
      recordedAt: params.recordedAt.toISOString(),
      status: params.route.status,
      city: schedule.city,
      state: schedule.state,
      storeName: store?.storeName ?? null,
      progress: mapped.progress,
      autoCompletedStops: params.autoCompletedStops,
      routeCompleted: params.routeCompleted,
      dwell: params.dwell
        ? {
            active: params.dwell.active,
            minutes: params.dwell.minutes,
            alertSent: params.dwell.alertSent,
            startedAt: params.dwell.startedAt ?? null,
          }
        : undefined,
    });
  }

  private async assertDriverRoute(routeId: string, driverId: string) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);
    if (route.driverId !== driverId) throw new AppError('Access denied.', 403);
    if (
      route.status !== RouteStatus.IN_PROGRESS &&
      route.status !== RouteStatus.ACTIVE
    ) {
      throw new AppError('Route must be active or in progress.', 400);
    }
    return route;
  }

  async reportLocation(
    routeId: string,
    driverId: string,
    lat: number,
    lng: number
  ) {
    const route = await this.assertDriverRoute(routeId, driverId);
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new AppError('Start the route before sharing location.', 400);
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new AppError('Invalid coordinates.', 400);
    }

    await this.driverLocationRepo.savePoint({ routeId, driverId, lat, lng });
    const recordedAt = new Date();
    await this.routeRepo.update(routeId, {
      driverLat: lat,
      driverLng: lng,
      driverLocationAt: recordedAt,
    });

    const dwell = await this.dwellDetection.evaluateLocationPing({
      routeId,
      driverId,
      teamId: route.teamId,
      lat,
      lng,
      recordedAt,
    });

    const { autoCompleted: autoCompletedStops, arrival: stopArrival } =
      await this.stopProximity.evaluateDriverAtStops({
        routeId,
        lat,
        lng,
        recordedAt,
      });

    const pickupProximity = await this.stopProximity.evaluatePickupProximity({
      routeId,
      lat,
      lng,
    });

    if (autoCompletedStops.length > 0) {
      await this.routeRepo.update(routeId, {
        deliveryVerification: DeliveryVerification.PENDING,
      });
      await this.notifyAutoCompletedStops({
        routeId,
        driverId,
        teamId: route.teamId,
        lat,
        lng,
        stops: autoCompletedStops,
      });
    }

    const refreshedRoute = await this.routeRepo.findById(routeId);
    const completedRoute = await this.tryAutoCompleteRoute(routeId, driverId);
    const routeForPublish =
      (await this.routeRepo.findById(routeId)) ?? refreshedRoute;

    if (routeForPublish) {
      await this.publishDriverLocation({
        route: routeForPublish,
        driverId,
        lat,
        lng,
        recordedAt,
        autoCompletedStops,
        routeCompleted: Boolean(completedRoute),
        dwell,
      });
    }

    console.log('[location-ping]', {
      routeId,
      driverId,
      lat,
      lng,
      recordedAt: recordedAt.toISOString(),
      dwell,
      autoCompletedStops,
      routeCompleted: Boolean(completedRoute),
    });

    return {
      lat,
      lng,
      recordedAt: recordedAt.toISOString(),
      dwell,
      autoCompletedStops,
      stopArrival: completedRoute ? null : stopArrival,
      pickupProximity,
      routeCompleted: Boolean(completedRoute),
    };
  }

  private async notifyAutoCompletedStops(params: {
    routeId: string;
    driverId: string;
    teamId: string;
    lat: number;
    lng: number;
    stops: { stopId: string; stopName: string }[];
  }): Promise<void> {
    const opsUsers = await this.userRepo.findActiveByRoles([
      UserRole.ADMIN,
      UserRole.DISPATCH_MANAGER,
    ]);
    const recipientIds = new Set<string>();
    for (const u of opsUsers) {
      if (u.id) recipientIds.add(u.id);
    }

    const driver = await this.userRepo.findById(params.driverId);
    const driverName =
      driver?.fullName?.trim() || driver?.email?.split('@')[0] || 'Driver';

    for (const stop of params.stops) {
      await this.notificationService.notifyStopAutoCompleted({
        recipientIds: [...recipientIds],
        routeId: params.routeId,
        driverId: params.driverId,
        driverName,
        stopId: stop.stopId,
        stopName: stop.stopName,
        lat: params.lat,
        lng: params.lng,
      });
    }
  }

  /** When every dropoff is delivered or returned, finish the route without a separate driver action. */
  private async tryAutoCompleteRoute(routeId: string, driverId: string) {
    const route = await this.routeRepo.findById(routeId);
    if (!route || route.driverId !== driverId) return null;

    const completed = await this.routeAutoComplete.maybeComplete(routeId);
    if (!completed) return null;

    return this.routeStopEnrichment.enrichRoute(completed);
  }

  private stopActionResult(
    stop: NonNullable<Awaited<ReturnType<IRouteStopRepository['updateById']>>>,
    completedRoute: Awaited<ReturnType<RouteDeliveryUseCase['tryAutoCompleteRoute']>>
  ) {
    return {
      stop,
      routeCompleted: Boolean(completedRoute),
      route: completedRoute ?? undefined,
    };
  }

  async completeStop(routeId: string, stopId: string, driverId: string) {
    const route = await this.assertDriverRoute(routeId, driverId);
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new AppError('Start the route before completing stops.', 400);
    }

    const stop = await this.routeStopRepo.findById(stopId);
    if (!stop || stop.routeId !== routeId) {
      throw new AppError('Stop not found.', 404);
    }
    if (stop.type === 'pickup') {
      throw new AppError('Cannot complete pickup stop.', 400);
    }
    if (stop.status !== RouteStopStatus.PENDING) {
      throw new AppError('Stop already finalized.', 400);
    }

    const updated = await this.routeStopRepo.updateById(stopId, {
      status: RouteStopStatus.COMPLETED,
      completedAt: new Date(),
      deliveryPhotoUrl: null,
      returnReason: null,
      returnReasonCustom: null,
      proximityEnteredAt: null,
      proximityAnchorLat: null,
      proximityAnchorLng: null,
    });
    if (!updated) throw new AppError('Failed to complete stop.', 500);

    await this.routeRepo.update(routeId, {
      deliveryVerification: DeliveryVerification.PENDING,
    });

    emitRouteUpdated({
      routeId,
      scheduleId: route.scheduleId,
      action: 'updated',
      driverIds: [driverId],
    });

    const completedRoute = await this.tryAutoCompleteRoute(routeId, driverId);

    return this.stopActionResult(updated, completedRoute);
  }

  async returnStop(
    routeId: string,
    stopId: string,
    driverId: string,
    reason: string,
    customReason?: string
  ) {
    const route = await this.assertDriverRoute(routeId, driverId);
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new AppError('Start the route before updating stops.', 400);
    }

    const preset = reason.trim();
    if (!RETURN_REASON_PRESETS.includes(preset as (typeof RETURN_REASON_PRESETS)[number])) {
      throw new AppError('Invalid return reason.', 400);
    }
    if (preset === 'custom' && !customReason?.trim()) {
      throw new AppError('Custom reason is required.', 400);
    }

    const stop = await this.routeStopRepo.findById(stopId);
    if (!stop || stop.routeId !== routeId) {
      throw new AppError('Stop not found.', 404);
    }
    if (stop.type === 'pickup') {
      throw new AppError('Cannot return pickup stop.', 400);
    }
    if (stop.status !== RouteStopStatus.PENDING) {
      throw new AppError('Stop already finalized.', 400);
    }

    const updated = await this.routeStopRepo.updateById(stopId, {
      status: RouteStopStatus.RETURNED,
      returnReason: preset,
      returnReasonCustom: preset === 'custom' ? customReason?.trim() || null : null,
      deliveryPhotoUrl: null,
      completedAt: new Date(),
    });
    if (!updated) throw new AppError('Failed to return stop.', 500);

    emitRouteUpdated({
      routeId,
      scheduleId: route.scheduleId,
      action: 'updated',
      driverIds: [driverId],
    });

    const completedRoute = await this.tryAutoCompleteRoute(routeId, driverId);

    return this.stopActionResult(updated, completedRoute);
  }

  async setStopAccessCode(
    routeId: string,
    stopId: string,
    accessCode: string,
    actor?: CityActor
  ) {
    const code = accessCode.trim();
    if (!code) throw new AppError('Access code is required.', 400);

    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);
    const schedule = await this.scheduleRepo.findById(route.scheduleId);
    if (schedule) enforceActorCity(actor, schedule.city);

    const stop = await this.routeStopRepo.findById(stopId);
    if (!stop || stop.routeId !== routeId) {
      throw new AppError('Stop not found.', 404);
    }
    if (stop.type !== 'dropoff') {
      throw new AppError('Access codes apply to dropoff stops only.', 400);
    }

    await this.addressCodeRepo.upsert(stop.address, code, stop.name);
    return this.routeStopRepo.updateById(stopId, { accessCode: code });
  }

  async completeRoute(routeId: string, driverId: string) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);
    if (route.driverId !== driverId) throw new AppError('Access denied.', 403);
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new AppError('Route is not in progress.', 400);
    }

    const stops = await this.routeStopRepo.findByRouteId(routeId);
    const dropoffs = stops.filter((s) => s.type === 'dropoff');
    const pending = dropoffs.filter((s) => s.status === RouteStopStatus.PENDING);
    if (pending.length > 0) {
      throw new AppError(
        `${pending.length} stop(s) still pending. Complete or return each stop first.`,
        400
      );
    }

    const completed = await this.routeAutoComplete.maybeComplete(routeId);
    if (!completed) throw new AppError('Failed to complete route.', 500);

    return this.routeStopEnrichment.enrichRoute(completed);
  }

  async getTracking(
    routeId: string,
    actor?: {
      role: UserRole | null;
      assignedCity?: string | null;
      assignedCities?: string[] | null;
    }
  ) {
    this.assertTrackingViewer(actor);

    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);

    const schedule = await this.scheduleRepo.findById(route.scheduleId);
    if (schedule) enforceActorCity(actor, schedule.city);

    if (schedule) {
      try {
        const store = schedule.storeId
          ? await this.storeRepo.findById(String(schedule.storeId))
          : null;
        await geocodeMissingRouteStops({
          routeStopRepo: this.routeStopRepo,
          routeId,
          geocodeContext: scheduleGeocodeContext({
            city: schedule.city,
            state: schedule.state,
            storeAddress: store?.address ?? null,
            storeState: store?.state ?? null,
          }),
        });
      } catch (error) {
        console.error(`Geocoding stops for tracking route ${routeId} failed`, error);
      }
    }

    const stops = await this.routeStopRepo.findByRouteId(routeId);
    const mapped = mapStopsToResponse(stops);
    const path = await this.driverLocationRepo.listByRoute(routeId);

    const enriched = await this.routeStopEnrichment.enrichRoute(route);

    return {
      route: {
        ...enriched,
        driverLocation:
          route.driverLat != null && route.driverLng != null
            ? {
                lat: route.driverLat,
                lng: route.driverLng,
                updatedAt: route.driverLocationAt,
              }
            : null,
        totalMiles: route.totalMiles,
      },
      scheduleCity: schedule?.city ?? null,
      scheduleState: schedule?.state ?? null,
      ...mapped,
      locationTrail: path.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        recordedAt: p.recordedAt,
      })),
    };
  }
}
