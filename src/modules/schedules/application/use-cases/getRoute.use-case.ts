import { AppError } from '../../../../shared/errors/app-error';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { mapScheduleToResponse } from '../mappers/scheduleResponse.mapper';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { UserRole } from '../../../../shared/constants/roles';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { enforceActorCity } from '../../../../shared/services/cityScope.service';
import { scheduleGeocodeContext } from '../utils/geocodeContext';

export class GetRouteUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository,
    private routeStopEnrichment: RouteStopEnrichmentService
  ) {}

  async execute(
    routeId: string,
    actor?: {
      id: string;
      role: UserRole | null;
      teamId?: string | null;
      assignedCity?: string | null;
      assignedCities?: string[] | null;
    }
  ) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);

    if (actor?.role === UserRole.DRIVER || actor?.role === UserRole.TEAM_DRIVER) {
      if (route.driverId !== actor.id) {
        throw new AppError('Access denied.', 403);
      }
    }

    if (actor?.role === UserRole.TEAM_LEAD) {
      if (!actor.teamId || route.teamId !== actor.teamId) {
        throw new AppError('Access denied.', 403);
      }
    }

    const schedule = await this.scheduleRepo.findById(route.scheduleId);
    if (schedule && actor?.role !== UserRole.TEAM_LEAD) {
      enforceActorCity(actor, schedule.city);
    }
    const team = await this.teamRepo.findById(route.teamId);
    const driver = route.driverId
      ? await this.userRepo.findById(route.driverId)
      : null;
    const store = schedule ? await this.storeRepo.findById(schedule.storeId) : null;

    const enriched = await this.routeStopEnrichment.enrichRoute(
      route,
      {
        teamName: team?.name,
        teamCode: team?.code,
        driverEmail: driver?.email,
        driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : null,
      },
      schedule
        ? {
            geocodeContext: scheduleGeocodeContext({
              city: schedule.city,
              state: schedule.state,
              storeState: schedule.state,
            }),
          }
        : undefined
    );

    return {
      ...enriched,
      schedule: schedule
        ? mapScheduleToResponse(schedule, store ? mapStoreToResponse(store) : null, [])
        : null,
    };
  }
}
