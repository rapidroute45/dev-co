import { AppError } from '../../../../shared/errors/app-error';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';

export class StartRouteUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private teamRepo: ITeamRepository,
    private routeStopEnrichment: RouteStopEnrichmentService
  ) {}

  async execute(routeId: string, driverUserId: string) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);
    if (route.driverId !== driverUserId) {
      throw new AppError('Access denied.', 403);
    }
    if (route.status !== RouteStatus.ACTIVE) {
      throw new AppError('Only active routes can be started.', 400);
    }

    const updated = await this.routeRepo.update(routeId, {
      status: RouteStatus.IN_PROGRESS,
      startedAt: new Date(),
    });
    if (!updated) throw new AppError('Route not found.', 404);

    const [schedule, team] = await Promise.all([
      this.scheduleRepo.findById(updated.scheduleId),
      this.teamRepo.findById(updated.teamId),
    ]);
    const store = schedule ? await this.storeRepo.findById(schedule.storeId) : null;

    return this.routeStopEnrichment.enrichRoute(updated, {
      teamName: team?.name,
      teamCode: team?.code,
    });
  }
}
