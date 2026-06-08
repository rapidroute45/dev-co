import { RouteStatus, ROUTE_STATUSES } from '../../../../shared/constants/routeStatuses';
import { Route } from '../../domain/entities/route.entity';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { RouteValidationService } from '../services/routeValidation.service';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { CreateRouteDTO } from '../dto/create-route.dto';
import { mapRouteToResponse } from '../mappers/scheduleResponse.mapper';
import { formatScheduleDate } from '../utils/scheduleDate';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { AppError } from '../../../../shared/errors/app-error';
import { ScheduleActivationService } from '../services/scheduleActivation.service';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { parsePickupDetail, parseStopDetails } from '../utils/routeStops';
import { buildGeocodedRouteStops } from '../services/routeStopGeo.service';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { AddressAccessCodeRepository } from '../../infrastructure/repositories/addressAccessCode.repository';
import { parseRouteCategoryInput } from '../../../../shared/utils/routeCategoryAccess';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';

export class CreateRouteUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private routeValidation: RouteValidationService,
    private notificationService: NotificationService,
    private storeRepo: IStoreRepository,
    private teamRepo: ITeamRepository,
    private scheduleActivation: ScheduleActivationService,
    private routeStopEnrichment: RouteStopEnrichmentService,
    private addressCodeRepo: AddressAccessCodeRepository
  ) {}

  async execute(dto: CreateRouteDTO, assignedByUserId: string, actor?: CityActor) {
    const schedule = await this.routeValidation.assertScheduleExists(dto.scheduleId);
    enforceActorCity(actor, schedule.city);
    const team = await this.routeValidation.assertTeamExists(dto.teamId);

    const times = this.routeValidation.parseAndValidateTimes(
      dto.arrivalTime,
      dto.departureTime
    );

    const hasDriver = Boolean(dto.driverId);
    let status = dto.status ?? RouteStatus.PENDING;

    if (!ROUTE_STATUSES.includes(status)) {
      throw new AppError('Invalid route status.', 400);
    }

    if (hasDriver) {
      if (status === RouteStatus.ASSIGNED) {
        status = RouteStatus.PENDING;
      }
      if (status === RouteStatus.ACTIVE) {
        throw new AppError(
          'Route cannot be created as active. The driver must accept the offer first.',
          400
        );
      }
    } else if (status !== RouteStatus.PENDING) {
      throw new AppError('driverId is required unless route status is pending.', 400);
    }

    let driver = null;
    if (hasDriver) {
      driver = await this.routeValidation.assertDriverOnTeam(dto.teamId, dto.driverId!);
      await this.routeValidation.assertDriverAvailable({
        driverId: dto.driverId!,
        scheduleDate: schedule.date,
        arrivalMinutes: times.arrivalMinutes,
        departureMinutes: times.departureMinutes,
      });
      status = RouteStatus.PENDING;
    }

    const stopDetails = parseStopDetails(dto.stopDetails) ?? [];
    const pickupDetail = parsePickupDetail(dto.pickupDetail);
    const dropoffCount = stopDetails.length > 0 ? stopDetails.length : dto.stops ?? null;

    const store = await this.storeRepo.findById(schedule.storeId);
    if (!store) throw new AppError('Schedule store not found.', 404);

    const route = new Route({
      scheduleId: dto.scheduleId,
      scheduleDate: schedule.date,
      teamId: dto.teamId,
      driverId: dto.driverId ?? null,
      routeName: dto.routeName?.trim() || null,
      routeCategory: parseRouteCategoryInput(dto.routeCategory),
      location: dto.location?.trim() || null,
      vehicleType: dto.vehicleType?.trim() || null,
      mileage: dto.mileage ?? null,
      stops: dropoffCount,
      arrivalTime: times.arrivalTime,
      departureTime: times.departureTime,
      arrivalMinutes: times.arrivalMinutes,
      departureMinutes: times.departureMinutes,
      status,
      assignedBy: assignedByUserId,
      notes: dto.notes?.trim() || null,
    });

    const saved = await this.routeRepo.save(route);

    const enrichedDropoffs = await Promise.all(
      stopDetails.map(async (d) => ({
        ...d,
        accessCode:
          d.accessCode ??
          (await this.addressCodeRepo.findByAddress(d.address)) ??
          undefined,
      }))
    );

    const stopRows = await buildGeocodedRouteStops({
      store,
      pickup: pickupDetail,
      dropoffs: enrichedDropoffs,
      geocodeContext: {
        city: schedule.city,
        state: schedule.state,
        country: 'Pakistan',
      },
    });
    await this.routeStopRepo.replaceForRoute(saved.id!, dto.scheduleId, stopRows);
    for (const d of enrichedDropoffs) {
      if (d.accessCode) {
        await this.addressCodeRepo.upsert(d.address, d.accessCode, d.name);
      }
    }

    await this.scheduleActivation.syncFromRoutes(dto.scheduleId);

    if (hasDriver && driver) {
      await this.notificationService.notifyRouteAssigned({
        driverId: dto.driverId!,
        teamLeadId: team.teamLeadId ?? null,
        scheduleDate: formatScheduleDate(schedule.date),
        storeName: store?.storeName ?? 'Store',
        city: schedule.city,
        state: schedule.state,
        arrivalTime: times.arrivalTime,
        departureTime: times.departureTime,
        teamName: team.name,
        routeId: saved.id!,
        scheduleId: schedule.id!,
      });
    }

    return this.routeStopEnrichment.enrichRoute(saved, {
      teamName: team.name,
      teamCode: team.code,
      driverEmail: driver?.email,
      driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : null,
    });
  }
}
