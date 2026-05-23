import { AppError } from '../../../../shared/errors/app-error';
import { ROUTE_STATUSES, RouteStatus } from '../../../../shared/constants/routeStatuses';
import {
  DELIVERY_VERIFICATIONS,
  DeliveryVerification,
} from '../../../../shared/constants/deliveryVerification';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { RouteValidationService } from '../services/routeValidation.service';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { mapRouteToResponse } from '../mappers/scheduleResponse.mapper';
import { formatScheduleDate } from '../utils/scheduleDate';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { ScheduleActivationService } from '../services/scheduleActivation.service';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import {
  buildRouteStopsForSave,
  parseStopDetails,
} from '../utils/routeStops';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { AddressAccessCodeRepository } from '../../infrastructure/repositories/addressAccessCode.repository';

export class UpdateRouteUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private routeValidation: RouteValidationService,
    private notificationService: NotificationService,
    private teamRepo: ITeamRepository,
    private storeRepo: IStoreRepository,
    private scheduleActivation: ScheduleActivationService,
    private routeStopEnrichment: RouteStopEnrichmentService,
    private addressCodeRepo: AddressAccessCodeRepository
  ) {}

  async execute(routeId: string, dto: Record<string, unknown>, _assignedByUserId: string) {
    const existing = await this.routeRepo.findById(routeId);
    if (!existing) throw new AppError('Route not found.', 404);

    const schedule = await this.routeValidation.assertScheduleExists(existing.scheduleId);
    const teamId = dto.teamId !== undefined ? String(dto.teamId) : existing.teamId;
    const team = await this.routeValidation.assertTeamExists(teamId);

    const driverId =
      dto.driverId !== undefined
        ? dto.driverId
          ? String(dto.driverId)
          : null
        : existing.driverId;

    let times = {
      arrivalTime: existing.arrivalTime,
      departureTime: existing.departureTime,
      arrivalMinutes: existing.arrivalMinutes,
      departureMinutes: existing.departureMinutes,
    };

    if (dto.arrivalTime !== undefined || dto.departureTime !== undefined) {
      times = this.routeValidation.parseAndValidateTimes(
        String(dto.arrivalTime ?? existing.arrivalTime),
        String(dto.departureTime ?? existing.departureTime)
      );
    }

    let driver = null;
    if (driverId) {
      driver = await this.routeValidation.assertDriverOnTeam(teamId, driverId);
      await this.routeValidation.assertDriverAvailable({
        driverId,
        scheduleDate: schedule.date,
        arrivalMinutes: times.arrivalMinutes,
        departureMinutes: times.departureMinutes,
        excludeRouteId: routeId,
      });
    }

    const patch: Parameters<IRouteRepository['update']>[1] = {
      teamId,
      driverId,
      ...times,
      scheduleDate: schedule.date,
    };

    if (dto.routeName !== undefined) patch.routeName = dto.routeName ? String(dto.routeName).trim() : null;
    if (dto.location !== undefined) patch.location = dto.location ? String(dto.location).trim() : null;
    if (dto.vehicleType !== undefined) {
      patch.vehicleType = dto.vehicleType ? String(dto.vehicleType).trim() : null;
    }
    if (dto.mileage !== undefined) patch.mileage = dto.mileage != null ? Number(dto.mileage) : null;
    const stopDetails = parseStopDetails(dto.stopDetails);
    if (stopDetails !== undefined) {
      patch.stops = stopDetails.length;
    } else if (dto.stops !== undefined) {
      patch.stops = dto.stops != null ? Number(dto.stops) : null;
    }
    if (dto.notes !== undefined) patch.notes = dto.notes ? String(dto.notes).trim() : null;

    const driverChanged =
      dto.driverId !== undefined && String(dto.driverId || '') !== String(existing.driverId || '');

    if (dto.status !== undefined) {
      const status = String(dto.status) as RouteStatus;
      if (!ROUTE_STATUSES.includes(status)) throw new AppError('Invalid route status.', 400);
      if (status === RouteStatus.ACTIVE) {
        throw new AppError(
          'Route cannot be set to active by a manager. The assigned driver must accept the offer.',
          400
        );
      }
      if (status === RouteStatus.NOT_VERIFIED) {
        if (existing.status !== RouteStatus.COMPLETED) {
          throw new AppError(
            'Only completed routes can be marked as not verified.',
            400
          );
        }
        patch.deliveryVerification = DeliveryVerification.REJECTED;
      }
      patch.status = status;
    }

    if (dto.deliveryVerification !== undefined) {
      const verification = String(dto.deliveryVerification) as DeliveryVerification;
      if (!DELIVERY_VERIFICATIONS.includes(verification)) {
        throw new AppError('Invalid delivery verification.', 400);
      }
      if (
        existing.status !== RouteStatus.COMPLETED &&
        existing.status !== RouteStatus.NOT_VERIFIED
      ) {
        throw new AppError(
          'Delivery verification applies to completed routes only.',
          400
        );
      }
      patch.deliveryVerification = verification;
      if (verification === DeliveryVerification.VERIFIED) {
        patch.status = RouteStatus.COMPLETED;
      }
      if (verification === DeliveryVerification.REJECTED) {
        patch.status = RouteStatus.NOT_VERIFIED;
      }
    } else if (driverChanged) {
      patch.status = RouteStatus.PENDING;
    } else if (!driverId && existing.driverId) {
      patch.status = RouteStatus.PENDING;
    }

    const updated = await this.routeRepo.update(routeId, patch);
    if (!updated) throw new AppError('Failed to update route.', 500);

    if (stopDetails !== undefined) {
      const store = await this.storeRepo.findById(schedule.storeId);
      if (!store) throw new AppError('Schedule store not found.', 404);
      const enrichedDetails = await Promise.all(
        stopDetails.map(async (d) => ({
          ...d,
          accessCode:
            d.accessCode ??
            (await this.addressCodeRepo.findByAddress(d.address)) ??
            undefined,
        }))
      );
      const stopRows = buildRouteStopsForSave(store, enrichedDetails);
      await this.routeStopRepo.replaceForRoute(routeId, existing.scheduleId, stopRows);
      for (const d of enrichedDetails) {
        if (d.accessCode) {
          await this.addressCodeRepo.upsert(d.address, d.accessCode, d.name);
        }
      }
    }

    const shouldNotify =
      driverId &&
      (dto.driverId !== undefined ||
        dto.arrivalTime !== undefined ||
        dto.departureTime !== undefined);

    if (shouldNotify && driver) {
      const store = await this.storeRepo.findById(schedule.storeId);
      await this.notificationService.notifyRouteAssigned({
        driverId,
        teamLeadId: team.teamLeadId ?? null,
        scheduleDate: formatScheduleDate(schedule.date),
        storeName: store?.storeName ?? 'Store',
        city: schedule.city,
        state: schedule.state,
        arrivalTime: times.arrivalTime,
        departureTime: times.departureTime,
        teamName: team.name,
        routeId: updated.id!,
        scheduleId: schedule.id!,
      });
    }

    await this.scheduleActivation.syncFromRoutes(updated.scheduleId);

    return this.routeStopEnrichment.enrichRoute(updated, {
      teamName: team.name,
      teamCode: team.code,
      driverEmail: driver?.email,
      driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : null,
    });
  }
}
