import { AppError } from '../../../../shared/errors/app-error';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { mapScheduleToResponse } from '../mappers/scheduleResponse.mapper';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { UserRole } from '../../../../shared/constants/roles';
import { enforceActorCity } from '../../../../shared/services/cityScope.service';
import {
  DispatchTeamAttributionService,
  shouldAttachDispatchTeamAttribution,
} from '../../../../shared/services/dispatchTeamAttribution.service';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { RouteAutoCompleteService } from '../services/routeAutoComplete.service';
import { TeamLeadScheduleAlertService } from '../services/teamLeadScheduleAlert.service';

export class GetScheduleUseCase {
  private dispatchTeamAttribution: DispatchTeamAttributionService;

  constructor(
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private routeRepo: IRouteRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository,
    private routeStopEnrichment: RouteStopEnrichmentService,
    private teamLeadAlertService: TeamLeadScheduleAlertService,
    private routeAutoComplete: RouteAutoCompleteService
  ) {
    this.dispatchTeamAttribution = new DispatchTeamAttributionService(userRepo);
  }

  async execute(
    scheduleId: string,
    actor?: {
      id: string;
      role: UserRole | null;
      teamId?: string | null;
      assignedCity?: string | null;
      assignedCities?: string[] | null;
    }
  ) {
    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule) throw new AppError('Schedule not found.', 404);

    if (actor?.role !== UserRole.TEAM_LEAD) {
      enforceActorCity(actor, schedule.city);
    }

    const store = await this.storeRepo.findById(schedule.storeId);
    let routes = await this.routeRepo.findManyByScheduleId(scheduleId);

    if (actor?.role === UserRole.DRIVER || actor?.role === UserRole.TEAM_DRIVER) {
      routes = routes.filter((r) => r.driverId === actor.id);
    } else if (actor?.role === UserRole.TEAM_LEAD) {
      const teamId = actor.teamId;
      if (!teamId) {
        routes = [];
      } else {
        routes = routes.filter((r) => r.teamId === teamId);
      }
    }

    routes = await Promise.all(
      routes.map(async (route) => {
        if (!route.id) return route;
        if (
          route.status !== RouteStatus.IN_PROGRESS &&
          route.status !== RouteStatus.ACTIVE
        ) {
          return route;
        }
        const completed = await this.routeAutoComplete.maybeComplete(route.id);
        return completed ?? route;
      })
    );

    const routeResponses = await this.routeStopEnrichment.enrichRoutes(
      routes,
      async (route) => {
        const team = await this.teamRepo.findById(route.teamId);
        const driver = route.driverId
          ? await this.userRepo.findById(route.driverId)
          : null;
        return {
          teamName: team?.name,
          teamCode: team?.code,
          driverEmail: driver?.email,
          driverName: driver
            ? resolveDisplayName(driver.fullName, driver.email)
            : null,
        };
      }
    );

    const dispatchTeam = shouldAttachDispatchTeamAttribution(actor?.role)
      ? await this.dispatchTeamAttribution.findByCity(schedule.city)
      : undefined;

    if (actor?.role === UserRole.TEAM_LEAD && actor.id) {
      await this.teamLeadAlertService.acknowledgeSchedule(scheduleId, actor.id);
    }

    return mapScheduleToResponse(
      schedule,
      store ? mapStoreToResponse(store) : null,
      routeResponses,
      { dispatchTeam }
    );
  }
}
