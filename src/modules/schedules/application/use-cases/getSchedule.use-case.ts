import { AppError } from '../../../../shared/errors/app-error';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { mapScheduleToResponse } from '../mappers/scheduleResponse.mapper';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { UserRole } from '../../../../shared/constants/roles';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';

export class GetScheduleUseCase {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private routeRepo: IRouteRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository,
    private routeStopEnrichment: RouteStopEnrichmentService
  ) {}

  async execute(scheduleId: string, actor?: { id: string; role: UserRole | null }) {
    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule) throw new AppError('Schedule not found.', 404);

    const store = await this.storeRepo.findById(schedule.storeId);
    let routes = await this.routeRepo.findManyByScheduleId(scheduleId);

    if (actor?.role === UserRole.DRIVER || actor?.role === UserRole.TEAM_DRIVER) {
      routes = routes.filter((r) => r.driverId === actor.id);
    } else if (actor?.role === UserRole.TEAM_LEAD && actor.id) {
      const team = await this.teamRepo.findById(
        (await this.userRepo.findById(actor.id))?.teamId ?? ''
      );
      if (team) {
        routes = routes.filter((r) => r.teamId === team.id);
      }
    }

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

    return mapScheduleToResponse(
      schedule,
      store ? mapStoreToResponse(store) : null,
      routeResponses
    );
  }
}
