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
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { RouteAutoCompleteService } from '../services/routeAutoComplete.service';
import { DriverLocationMonitorService } from '../services/driverLocationMonitor.service';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { geocodeMissingRouteStops } from '../services/routeStopGeo.service';
import { scheduleGeocodeContext } from '../utils/geocodeContext';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';
import { emitRouteUpdated, emitDriverCurrentLocation } from '../../../chat/socket/chat.socket';
import {
  MAX_TRAIL_EMIT_POINTS,
  mergeRoutePathPoints,
} from '../utils/routePath';

export class RouteDeliveryUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private addressCodeRepo: AddressAccessCodeRepository,
    private routeStopEnrichment: RouteStopEnrichmentService,
    private routeAutoComplete: RouteAutoCompleteService,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private locationMonitor: DriverLocationMonitorService
  ) {}

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

  private async assertDispatchStopUpdate(routeId: string, actor?: CityActor) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);
    const schedule = await this.scheduleRepo.findById(route.scheduleId);
    if (schedule) enforceActorCity(actor, schedule.city);
    if (!route.driverId) {
      throw new AppError('Assign a driver before updating stop status.', 400);
    }
    return route;
  }

  async completeStopAsDispatch(routeId: string, stopId: string, actor?: CityActor) {
    return this.updateStopStatusAsDispatch(
      routeId,
      stopId,
      RouteStopStatus.COMPLETED,
      actor
    );
  }

  async returnStopAsDispatch(
    routeId: string,
    stopId: string,
    reason: string,
    customReason: string | undefined,
    actor?: CityActor
  ) {
    return this.updateStopStatusAsDispatch(
      routeId,
      stopId,
      RouteStopStatus.RETURNED,
      actor,
      reason,
      customReason
    );
  }

  async updateStopStatusAsDispatch(
    routeId: string,
    stopId: string,
    status: RouteStopStatus,
    actor?: CityActor,
    reason?: string,
    customReason?: string
  ) {
    const route = await this.assertDispatchStopUpdate(routeId, actor);
    const allowedRouteStatuses = new Set<RouteStatus>([
      RouteStatus.ACTIVE,
      RouteStatus.IN_PROGRESS,
      RouteStatus.COMPLETED,
      RouteStatus.NOT_VERIFIED,
    ]);
    if (!allowedRouteStatuses.has(route.status as RouteStatus)) {
      throw new AppError('Stop status cannot be changed on this route.', 400);
    }

    const stop = await this.routeStopRepo.findById(stopId);
    if (!stop || stop.routeId !== routeId) {
      throw new AppError('Stop not found.', 404);
    }
    if (stop.type === 'pickup') {
      throw new AppError('Pickup stop cannot be updated.', 400);
    }

    if (status === RouteStopStatus.RETURNED) {
      const preset = reason?.trim() ?? '';
      if (!RETURN_REASON_PRESETS.includes(preset as (typeof RETURN_REASON_PRESETS)[number])) {
        throw new AppError('Invalid return reason.', 400);
      }
      if (preset === 'custom' && !customReason?.trim()) {
        throw new AppError('Custom reason is required.', 400);
      }
    }

    let patch: Parameters<IRouteStopRepository['updateById']>[1];
    if (status === RouteStopStatus.PENDING) {
      patch = {
        status: RouteStopStatus.PENDING,
        completedAt: null,
        returnReason: null,
        returnReasonCustom: null,
        deliveryPhotoUrl: null,
      };
    } else if (status === RouteStopStatus.COMPLETED) {
      patch = {
        status: RouteStopStatus.COMPLETED,
        completedAt: new Date(),
        returnReason: null,
        returnReasonCustom: null,
        deliveryPhotoUrl: null,
      };
    } else {
      const preset = reason!.trim();
      patch = {
        status: RouteStopStatus.RETURNED,
        completedAt: new Date(),
        returnReason: preset,
        returnReasonCustom: preset === 'custom' ? customReason?.trim() || null : null,
        deliveryPhotoUrl: null,
      };
    }

    const updated = await this.routeStopRepo.updateById(stopId, patch);
    if (!updated) throw new AppError('Failed to update stop.', 500);

    const driverId = route.driverId!;
    const allStops = await this.routeStopRepo.findByRouteId(routeId);
    const dropoffs = allStops.filter((s) => s.type === 'dropoff');
    const pendingCount = dropoffs.filter((s) => s.status === RouteStopStatus.PENDING).length;

    let effectiveStatus = route.status as RouteStatus;
    if (
      pendingCount > 0 &&
      (effectiveStatus === RouteStatus.COMPLETED || effectiveStatus === RouteStatus.NOT_VERIFIED)
    ) {
      await this.routeRepo.update(routeId, {
        status: RouteStatus.IN_PROGRESS,
        deliveryVerification: DeliveryVerification.PENDING,
      });
      effectiveStatus = RouteStatus.IN_PROGRESS;
    }

    if (status === RouteStopStatus.COMPLETED) {
      await this.routeRepo.update(routeId, {
        deliveryVerification: DeliveryVerification.PENDING,
      });
    }

    emitRouteUpdated({
      routeId,
      scheduleId: route.scheduleId,
      action: 'updated',
      driverIds: [driverId],
    });

    let completedRoute: Awaited<ReturnType<RouteDeliveryUseCase['tryAutoCompleteRoute']>> = null;
    if (
      pendingCount === 0 &&
      (effectiveStatus === RouteStatus.IN_PROGRESS || effectiveStatus === RouteStatus.ACTIVE)
    ) {
      completedRoute = await this.tryAutoCompleteRoute(routeId, driverId);
    }

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

  /** One-time current location snapshot when the driver starts a route. */
  async reportCurrentLocation(routeId: string, driverId: string, lat: number, lng: number) {
    const route = await this.assertDriverRoute(routeId, driverId);
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new AppError('Start the route before sharing location.', 400);
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new AppError('Invalid coordinates.', 400);
    }
    if (route.driverLocationAt != null && route.driverLat != null && route.driverLng != null) {
      throw new AppError('Location already shared for this route.', 409);
    }

    const recordedAt = new Date();
    const startPoint = { lat, lng, recordedAt };
    const driverRoutePath = mergeRoutePathPoints(route.driverRoutePath ?? [], [startPoint]);

    await this.routeRepo.update(routeId, {
      driverLat: lat,
      driverLng: lng,
      driverLocationAt: recordedAt,
      driverLocationIngestedAt: recordedAt,
      driverLocationBackgroundSharing: false,
      driverRoutePath,
    });

    emitDriverCurrentLocation({
      routeId,
      scheduleId: route.scheduleId,
      driverId,
      lat,
      lng,
      recordedAt: recordedAt.toISOString(),
      trailPoints: [
        {
          lat,
          lng,
          recordedAt: recordedAt.toISOString(),
        },
      ],
    });

    return {
      lat,
      lng,
      recordedAt: recordedAt.toISOString(),
    };
  }

  /** 1-minute mobile batch: persist path on route and publish latest + trail to dispatch. */
  async reportLocationBatch(
    routeId: string,
    driverId: string,
    points: Array<{ lat: number; lng: number; rawLat?: number; rawLng?: number; recordedAt?: string }>,
    meta?: { plannedStopId?: string; progressIndex?: number }
  ) {
    const route = await this.assertDriverRoute(routeId, driverId);
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new AppError('Start the route before sharing location.', 400);
    }
    if (!Array.isArray(points) || points.length === 0) {
      throw new AppError('No location points provided.', 400);
    }

    const ordered = [...points]
      .map((point) => {
        const lat = Number(point.rawLat ?? point.lat);
        const lng = Number(point.rawLng ?? point.lng);
        return {
          lat,
          lng,
          rawLat: Number.isFinite(Number(point.rawLat)) ? Number(point.rawLat) : lat,
          rawLng: Number.isFinite(Number(point.rawLng)) ? Number(point.rawLng) : lng,
          recordedAt: parseClientRecordedAt(point.recordedAt),
        };
      })
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

    if (ordered.length === 0) {
      throw new AppError('No valid location points in batch.', 400);
    }

    const latest = ordered[ordered.length - 1]!;
    const ingestedAt = new Date();
    const incomingPath = ordered.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      recordedAt: point.recordedAt,
    }));
    const driverRoutePath = mergeRoutePathPoints(route.driverRoutePath ?? [], incomingPath);

    const routePatch: Parameters<typeof this.routeRepo.update>[1] = {
      driverLat: latest.lat,
      driverLng: latest.lng,
      driverLocationAt: latest.recordedAt,
      driverLocationIngestedAt: ingestedAt,
      driverLocationBackgroundSharing: false,
      driverRoutePath,
    };

    if (meta?.plannedStopId) {
      routePatch.driverRouteSegmentStopId = meta.plannedStopId;
    }
    if (typeof meta?.progressIndex === 'number' && Number.isFinite(meta.progressIndex)) {
      routePatch.driverRouteProgressIndex = Math.max(0, Math.floor(meta.progressIndex));
    }

    const updatedRoute =
      (await this.routeRepo.update(routeId, routePatch)) ?? route;

    let scheduleCity: string | null = null;
    try {
      const schedule = await this.scheduleRepo.findById(route.scheduleId);
      scheduleCity = schedule?.city ?? null;
    } catch (error) {
      console.warn('[location-batch] schedule lookup failed', { routeId, error });
    }

    try {
      await this.locationMonitor.processLocationBatch(
        updatedRoute,
        ordered.map((point) => ({
          lat: point.lat,
          lng: point.lng,
          rawLat: point.rawLat,
          rawLng: point.rawLng,
          recordedAt: point.recordedAt,
        })),
        scheduleCity
      );
    } catch (error) {
      console.warn('[location-batch] monitor failed — location still saved', {
        routeId,
        driverId,
        error,
      });
    }

    const routeForEmit = (await this.routeRepo.findById(routeId)) ?? updatedRoute;

    try {
      const trailSlice = ordered.slice(-MAX_TRAIL_EMIT_POINTS);
      emitDriverCurrentLocation({
        routeId,
        scheduleId: route.scheduleId,
        driverId,
        lat: latest.lat,
        lng: latest.lng,
        recordedAt: latest.recordedAt.toISOString(),
        trailPoints: trailSlice.map((point) => ({
          lat: point.lat,
          lng: point.lng,
          recordedAt: point.recordedAt.toISOString(),
        })),
        dwell: this.locationMonitor.buildDwellPayload(routeForEmit),
        segmentStopId: routeForEmit.driverRouteSegmentStopId ?? undefined,
        progressIndex: routeForEmit.driverRouteProgressIndex ?? undefined,
      });
    } catch (error) {
      console.warn('[location-batch] socket emit failed — location still saved', {
        routeId,
        driverId,
        error,
      });
    }

    console.log('[location-batch]', {
      routeId,
      driverId,
      accepted: ordered.length,
      received: points.length,
    });

    return {
      accepted: ordered.length,
      received: points.length,
      lat: latest.lat,
      lng: latest.lng,
      recordedAt: latest.recordedAt.toISOString(),
    };
  }
}

function parseClientRecordedAt(value?: string | Date | null): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed);
    }
  }
  return new Date();
}
