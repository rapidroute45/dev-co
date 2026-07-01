import { AppError } from '../../../../shared/errors/app-error';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { formatScheduleDate, parseScheduleDate } from '../utils/scheduleDate';
import { estimateRouteDriveDurationSec } from '../utils/estimateRouteDriveDuration';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';

export class ListMyRoutesUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private teamRepo: ITeamRepository,
    private routeStopEnrichment: RouteStopEnrichmentService
  ) {}

  async execute(driverUserId: string, query: Record<string, string>) {
    const date = query.date?.trim();
    if (!date) {
      throw new AppError('date query parameter is required (YYYY-MM-DD).', 400);
    }

    const scheduleDate = parseScheduleDate(date);
    const byDate = await this.routeRepo.findManyByDriverId(driverUserId, {
      fromDate: scheduleDate,
      toDate: scheduleDate,
    });

    /** Routes started before midnight stay in_progress on the prior schedule date. */
    const inProgressAnyDay = await this.routeRepo.findManyByDriverId(driverUserId, {
      status: RouteStatus.IN_PROGRESS,
    });
    const seen = new Set(byDate.map((r) => r.id).filter(Boolean) as string[]);
    const crossDate = inProgressAnyDay.filter((r) => r.id && !seen.has(r.id));
    const routes = [...crossDate, ...byDate];

    const enriched = await this.routeStopEnrichment.enrichRoutes(routes, async (route) => {
      const team = await this.teamRepo.findById(route.teamId);
      return { teamName: team?.name, teamCode: team?.code };
    });

    const items = await Promise.all(
      enriched.map(async (routeDto, index) => {
        const route = routes[index]!;
        const schedule = await this.scheduleRepo.findById(route.scheduleId);
        const store = schedule ? await this.storeRepo.findById(schedule.storeId) : null;

        let estimatedDriveDurationSec: number | null = null;
        try {
          estimatedDriveDurationSec = await estimateRouteDriveDurationSec({
            route,
            pickup: routeDto.pickup as Parameters<typeof estimateRouteDriveDurationSec>[0]['pickup'],
            dropoffs: (routeDto.dropoffs ?? []) as Parameters<
              typeof estimateRouteDriveDurationSec
            >[0]['dropoffs'],
          });
        } catch (error) {
          console.warn('[list-my-routes] drive duration estimate failed', {
            routeId: route.id,
            error,
          });
        }

        return {
          ...routeDto,
          estimatedDriveDurationSec,
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

    return { date, items, count: items.length };
  }
}
