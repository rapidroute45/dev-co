import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { formatScheduleDate } from '../utils/scheduleDate';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';

export class ListPendingRouteOffersUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private teamRepo: ITeamRepository,
    private routeStopEnrichment: RouteStopEnrichmentService
  ) {}

  async execute(driverUserId: string) {
    const routes = await this.routeRepo.findPendingOffersForDriver(driverUserId);

    const enriched = await this.routeStopEnrichment.enrichRoutes(routes, async (route) => {
      const team = await this.teamRepo.findById(route.teamId);
      return { teamName: team?.name, teamCode: team?.code };
    });

    return Promise.all(
      enriched.map(async (routeDto, index) => {
        const route = routes[index];
        const schedule = await this.scheduleRepo.findById(route.scheduleId);
        const store = schedule ? await this.storeRepo.findById(schedule.storeId) : null;

        return {
          ...routeDto,
          schedule: schedule
            ? {
                id: schedule.id,
                date: formatScheduleDate(schedule.date),
                city: schedule.city,
                state: schedule.state,
                store: store ? mapStoreToResponse(store) : null,
              }
            : null,
        };
      })
    );
  }
}
