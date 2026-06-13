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
import { parsePickupDetail, parseStopDetails } from '../utils/routeStops';
import { buildGeocodedRouteStops, scheduleRouteStopGeocoding, shouldDeferStopGeocoding } from '../services/routeStopGeo.service';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { AddressAccessCodeRepository } from '../../infrastructure/repositories/addressAccessCode.repository';
import { parseRouteCategoryInput } from '../../../../shared/utils/routeCategoryAccess';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';
import { scheduleGeocodeContext } from '../utils/geocodeContext';
import {
  OPS_VERIFICATION_STATUSES,
  OpsVerificationStatus,
} from '../../../../shared/constants/opsVerification';
import { UserRole } from '../../../../shared/constants/roles';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { emitRouteUpdated } from '../../../chat/socket/chat.socket';
import { TeamLeadScheduleAlertService } from '../services/teamLeadScheduleAlert.service';
import { RouteAutoCompleteService } from '../services/routeAutoComplete.service';

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
    private addressCodeRepo: AddressAccessCodeRepository,
    private userRepo: IUserRepository,
    private teamLeadAlertService: TeamLeadScheduleAlertService,
    private routeAutoComplete: RouteAutoCompleteService
  ) {}

  async execute(
    routeId: string,
    dto: Record<string, unknown>,
    _assignedByUserId: string,
    actor?: CityActor
  ) {
    const existing = await this.routeRepo.findById(routeId);
    if (!existing) throw new AppError('Route not found.', 404);

    const schedule = await this.routeValidation.assertScheduleExists(existing.scheduleId);
    enforceActorCity(actor, schedule.city);
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
    if (dto.routeCategory !== undefined) {
      patch.routeCategory = parseRouteCategoryInput(dto.routeCategory);
    }
    if (dto.location !== undefined) patch.location = dto.location ? String(dto.location).trim() : null;
    if (dto.vehicleType !== undefined) {
      patch.vehicleType = dto.vehicleType ? String(dto.vehicleType).trim() : null;
    }
    if (dto.mileage !== undefined) patch.mileage = dto.mileage != null ? Number(dto.mileage) : null;
    const stopDetails = parseStopDetails(dto.stopDetails);
    const pickupDetail = parsePickupDetail(dto.pickupDetail);
    if (stopDetails !== undefined) {
      patch.stops = stopDetails.length;
    } else if (dto.stops !== undefined) {
      patch.stops = dto.stops != null ? Number(dto.stops) : null;
    }
    if (dto.notes !== undefined) patch.notes = dto.notes ? String(dto.notes).trim() : null;
    if (dto.overtimeHours !== undefined) {
      const hours = Number(dto.overtimeHours);
      if (!Number.isFinite(hours) || hours < 0) {
        throw new AppError('overtimeHours must be a non-negative number.', 400);
      }
      patch.overtimeHours = hours;
    }

    if (dto.opsVerificationStatus !== undefined) {
      const nextStatus = String(dto.opsVerificationStatus) as OpsVerificationStatus;
      if (!OPS_VERIFICATION_STATUSES.includes(nextStatus)) {
        throw new AppError('Invalid ops verification status.', 400);
      }

      const role = actor?.role ?? null;
      const isManager =
        role === UserRole.ADMIN || role === UserRole.DISPATCH_MANAGER;
      const isDispatchTeam = role === UserRole.DISPATCH_TEAM;
      const current =
        existing.opsVerificationStatus ?? OpsVerificationStatus.PENDING;

      if (existing.status !== RouteStatus.COMPLETED) {
        throw new AppError('Ops verification applies to completed routes only.', 400);
      }

      if (nextStatus === OpsVerificationStatus.TEAM_VERIFIED) {
        if (!isDispatchTeam && !isManager) {
          throw new AppError('Only dispatch team or managers can verify routes.', 403);
        }
        if (
          current !== OpsVerificationStatus.PENDING &&
          current !== OpsVerificationStatus.REJECTED
        ) {
          throw new AppError('Route is already verified by the dispatch team.', 400);
        }
        patch.opsVerificationStatus = nextStatus;
        patch.teamVerifiedAt = new Date();
        patch.teamVerifiedBy = _assignedByUserId;
      } else if (nextStatus === OpsVerificationStatus.MANAGER_VERIFIED) {
        if (!isManager) {
          throw new AppError('Only dispatch managers can complete manager verification.', 403);
        }
        if (current === OpsVerificationStatus.MANAGER_VERIFIED) {
          throw new AppError('Route is already manager-verified.', 400);
        }
        patch.opsVerificationStatus = nextStatus;
        patch.managerVerifiedAt = new Date();
        patch.managerVerifiedBy = _assignedByUserId;
      } else if (nextStatus === OpsVerificationStatus.REJECTED) {
        if (!isDispatchTeam && !isManager) {
          throw new AppError('Only ops roles can reject route verification.', 403);
        }
        patch.opsVerificationStatus = nextStatus;
      } else if (nextStatus === OpsVerificationStatus.PENDING) {
        if (!isManager) {
          throw new AppError('Only managers can reset ops verification.', 403);
        }
        patch.opsVerificationStatus = nextStatus;
        patch.teamVerifiedAt = null;
        patch.teamVerifiedBy = null;
        patch.managerVerifiedAt = null;
        patch.managerVerifiedBy = null;
      }
    }

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
      if (status === RouteStatus.COMPLETED && existing.status !== RouteStatus.COMPLETED) {
        patch.completedAt = new Date();
      }
    }

    if (dto.deliveryVerification !== undefined) {
      const verification = String(dto.deliveryVerification) as DeliveryVerification;
      if (!DELIVERY_VERIFICATIONS.includes(verification)) {
        throw new AppError('Invalid delivery verification.', 400);
      }
      const canVerifyInProgress = existing.status === RouteStatus.IN_PROGRESS;
      if (
        existing.status !== RouteStatus.COMPLETED &&
        existing.status !== RouteStatus.NOT_VERIFIED &&
        !canVerifyInProgress
      ) {
        throw new AppError(
          'Delivery verification applies to completed or in-progress routes with GPS proof.',
          400
        );
      }
      patch.deliveryVerification = verification;
      if (verification === DeliveryVerification.VERIFIED) {
        if (existing.status !== RouteStatus.IN_PROGRESS) {
          patch.status = RouteStatus.COMPLETED;
        }
      }
      if (verification === DeliveryVerification.REJECTED) {
        if (existing.status === RouteStatus.IN_PROGRESS) {
          patch.deliveryVerification = DeliveryVerification.REJECTED;
        } else {
          patch.status = RouteStatus.NOT_VERIFIED;
        }
      }
    } else if (driverChanged) {
      const keepStatus =
        existing.status === RouteStatus.COMPLETED ||
        existing.status === RouteStatus.NOT_VERIFIED;
      if (!keepStatus) patch.status = RouteStatus.PENDING;
    } else if (!driverId && existing.driverId) {
      const keepStatus =
        existing.status === RouteStatus.COMPLETED ||
        existing.status === RouteStatus.NOT_VERIFIED;
      if (!keepStatus) patch.status = RouteStatus.PENDING;
    }

    const updated = await this.routeRepo.update(routeId, patch);
    if (!updated) throw new AppError('Failed to update route.', 500);

    if (stopDetails !== undefined || pickupDetail !== undefined) {
      const store = await this.storeRepo.findById(schedule.storeId);
      if (!store) throw new AppError('Schedule store not found.', 404);

      const existingStops = await this.routeStopRepo.findByRouteId(routeId);
      const existingDropoffs = existingStops
        .filter((s) => s.type === 'dropoff')
        .sort((a, b) => a.sequence - b.sequence);

      const dropoffSource =
        stopDetails ??
        existingDropoffs.map((s) => ({
          name: s.name,
          address: s.address,
          accessCode: s.accessCode ?? undefined,
          lat: s.destinationLat ?? undefined,
          lng: s.destinationLng ?? undefined,
          placeId: s.placeId ?? undefined,
        }));

      const existingPickup = existingStops.find((s) => s.type === 'pickup');
      const pickupSource =
        pickupDetail ??
        (existingPickup
          ? {
              name: existingPickup.name,
              address: existingPickup.address,
              lat: existingPickup.destinationLat ?? undefined,
              lng: existingPickup.destinationLng ?? undefined,
              placeId: existingPickup.placeId ?? undefined,
            }
          : undefined);

      const enrichedDropoffs = await Promise.all(
        dropoffSource.map(async (d) => ({
          ...d,
          accessCode:
            d.accessCode ??
            (await this.addressCodeRepo.findByAddress(d.address)) ??
            undefined,
        }))
      );

      const geocodeContext = scheduleGeocodeContext({
        city: schedule.city,
        state: schedule.state,
        storeAddress: store.address,
        storeState: store.state,
      });
      const deferGeocoding = shouldDeferStopGeocoding(enrichedDropoffs.length);

      const stopRows = await buildGeocodedRouteStops({
        store,
        pickup: pickupSource,
        dropoffs: enrichedDropoffs,
        geocodeContext,
        skipExternalGeocoding: deferGeocoding,
      });
      await this.routeStopRepo.replaceForRoute(routeId, existing.scheduleId, stopRows);
      if (deferGeocoding) {
        scheduleRouteStopGeocoding({
          routeStopRepo: this.routeStopRepo,
          routeId,
          geocodeContext,
        });
      }
      for (const d of enrichedDropoffs) {
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

    if (
      dto.opsVerificationStatus === OpsVerificationStatus.TEAM_VERIFIED &&
      actor?.role === UserRole.DISPATCH_TEAM
    ) {
      const store = await this.storeRepo.findById(schedule.storeId);
      const managers = await this.userRepo.findActiveByRoles([
        UserRole.ADMIN,
        UserRole.DISPATCH_MANAGER,
      ]);
      await this.notificationService.notifyRouteOpsTeamVerified({
        recipientIds: managers.map((m) => m.id!).filter(Boolean),
        routeId: updated.id!,
        scheduleId: schedule.id!,
        storeName: store?.storeName ?? 'Store',
        city: schedule.city,
        teamName: team.name,
      });
    }

    await this.scheduleActivation.syncFromRoutes(updated.scheduleId);
    await this.teamLeadAlertService.syncForSchedule(updated.scheduleId);

    const realtimeDriverIds: string[] = [];
    if (driverId) realtimeDriverIds.push(driverId);
    if (driverChanged && existing.driverId) {
      realtimeDriverIds.push(String(existing.driverId));
    }
    if (realtimeDriverIds.length > 0) {
      emitRouteUpdated({
        routeId: updated.id!,
        scheduleId: schedule.id!,
        action: 'updated',
        driverIds: realtimeDriverIds,
      });
    }

    const reconciled = await this.routeAutoComplete.maybeComplete(updated.id!);
    const routeToReturn = reconciled ?? updated;

    return this.routeStopEnrichment.enrichRoute(routeToReturn, {
      teamName: team.name,
      teamCode: team.code,
      driverEmail: driver?.email,
      driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : null,
    });
  }
}
