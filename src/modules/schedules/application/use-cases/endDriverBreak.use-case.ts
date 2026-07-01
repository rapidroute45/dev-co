import { AppError } from '../../../../shared/errors/app-error';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { DriverBreakService } from '../services/driverBreak.service';
import { isDriverBreakActive } from '../utils/driverBreak.utils';

export class EndDriverBreakUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository,
    private teamRepo: ITeamRepository,
    private routeStopEnrichment: RouteStopEnrichmentService,
    private driverBreakService: DriverBreakService
  ) {}

  async execute(routeId: string, driverUserId: string) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);
    if (route.driverId !== driverUserId) {
      throw new AppError('Access denied.', 403);
    }
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new AppError('Break is only available on in-progress routes.', 400);
    }
    if (!isDriverBreakActive(route)) {
      throw new AppError('No active break to end.', 400);
    }

    const schedule = await this.scheduleRepo.findById(route.scheduleId);
    const updated =
      (await this.driverBreakService.endBreak(route, 'manual', schedule?.city ?? null)) ?? route;

    const team = await this.teamRepo.findById(updated.teamId);
    return this.routeStopEnrichment.enrichRoute(updated, {
      teamName: team?.name,
      teamCode: team?.code,
    });
  }
}
