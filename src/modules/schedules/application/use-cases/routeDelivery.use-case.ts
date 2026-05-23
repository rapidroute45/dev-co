import { AppError } from '../../../../shared/errors/app-error';
import {
  RETURN_REASON_PRESETS,
  RouteStopStatus,
} from '../../../../shared/constants/routeStopStatuses';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { DeliveryVerification } from '../../../../shared/constants/deliveryVerification';
import { publicUploadPath } from '../../../../shared/upload/upload.config';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { AddressAccessCodeRepository } from '../../infrastructure/repositories/addressAccessCode.repository';
import { DriverLocationRepository } from '../../infrastructure/repositories/driverLocation.repository';
import { sumLocationPathMiles } from '../utils/haversine';
import { mapStopsToResponse } from '../utils/routeStops';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { ChatService } from '../../../chat/application/services/chat.service';

export class RouteDeliveryUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private driverLocationRepo: DriverLocationRepository,
    private addressCodeRepo: AddressAccessCodeRepository,
    private routeStopEnrichment: RouteStopEnrichmentService,
    private chatService?: ChatService
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
    await this.routeRepo.update(routeId, {
      driverLat: lat,
      driverLng: lng,
      driverLocationAt: new Date(),
    });

    return { lat, lng, recordedAt: new Date().toISOString() };
  }

  async completeStop(
    routeId: string,
    stopId: string,
    driverId: string,
    photoFilename: string,
    coords?: { lat?: number; lng?: number }
  ) {
    const route = await this.assertDriverRoute(routeId, driverId);
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new AppError('Start the route before completing stops.', 400);
    }

    const stop = await this.routeStopRepo.findById(stopId);
    if (!stop || stop.routeId !== routeId) {
      throw new AppError('Stop not found.', 404);
    }
    if (stop.type === 'pickup') {
      throw new AppError('Use dropoff stops for delivery confirmation.', 400);
    }
    if (stop.status !== RouteStopStatus.PENDING) {
      throw new AppError('Stop already finalized.', 400);
    }

    const updated = await this.routeStopRepo.updateById(stopId, {
      status: RouteStopStatus.COMPLETED,
      deliveryPhotoUrl: publicUploadPath(photoFilename),
      returnReason: null,
      returnReasonCustom: null,
      completedAt: new Date(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });

    if (updated && this.chatService) {
      void this.chatService
        .notifyDeliveryPhoto({
          routeId,
          driverId,
          stopId,
          stopName: updated.name ?? stop.name,
          photoUrl: publicUploadPath(photoFilename),
        })
        .catch((err) => console.warn('[chat] delivery photo notify failed', err));
    }

    return updated;
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

    return this.routeStopRepo.updateById(stopId, {
      status: RouteStopStatus.RETURNED,
      returnReason: preset,
      returnReasonCustom: preset === 'custom' ? customReason?.trim() || null : null,
      deliveryPhotoUrl: null,
      completedAt: new Date(),
    });
  }

  async setStopAccessCode(
    routeId: string,
    stopId: string,
    accessCode: string
  ) {
    const code = accessCode.trim();
    if (!code) throw new AppError('Access code is required.', 400);

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

    const path = await this.driverLocationRepo.listByRoute(routeId);
    const totalMiles = sumLocationPathMiles(path);

    const updated = await this.routeRepo.update(routeId, {
      status: RouteStatus.COMPLETED,
      deliveryVerification: DeliveryVerification.PENDING,
      totalMiles: totalMiles > 0 ? totalMiles : route.mileage,
      completedAt: new Date(),
    });
    if (!updated) throw new AppError('Failed to complete route.', 500);

    return this.routeStopEnrichment.enrichRoute(updated);
  }

  async getTracking(routeId: string) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);

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
      ...mapped,
      locationTrail: path.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        recordedAt: p.recordedAt,
      })),
    };
  }
}
