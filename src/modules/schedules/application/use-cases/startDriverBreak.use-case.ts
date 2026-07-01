import { AppError } from '../../../../shared/errors/app-error';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { DriverBreakService } from '../services/driverBreak.service';
import {
  isDriverBreakActive,
  validateBreakDurationMinutes,
} from '../utils/driverBreak.utils';

export class StartDriverBreakUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository,
    private teamRepo: ITeamRepository,
    private routeStopEnrichment: RouteStopEnrichmentService,
    private driverBreakService: DriverBreakService
  ) {}

  async execute(routeId: string, driverUserId: string, body: { durationMinutes?: unknown }) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);
    if (route.driverId !== driverUserId) {
      throw new AppError('Access denied.', 403);
    }
    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new AppError('Break is only available on in-progress routes.', 400);
    }
    if (isDriverBreakActive(route)) {
      throw new AppError('A break is already in progress.', 400);
    }

    let durationMinutes: number;
    try {
      durationMinutes = validateBreakDurationMinutes(body.durationMinutes);
    } catch (error) {
      throw new AppError((error as Error).message, 400);
    }

    if (route.driverLat == null || route.driverLng == null) {
      throw new AppError('Share your location before starting a break.', 400);
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationMinutes * 60_000);

    const updated = await this.routeRepo.update(routeId, {
      driverBreakStartedAt: startedAt,
      driverBreakEndsAt: endsAt,
      driverBreakDurationMin: durationMinutes,
      driverBreakAnchorLat: route.driverLat,
      driverBreakAnchorLng: route.driverLng,
      driverBreakMovementAlertSentAt: null,
      driverDwellAlertSentAt: null,
    });
    if (!updated) throw new AppError('Route not found.', 404);

    const schedule = await this.scheduleRepo.findById(updated.scheduleId);
    await this.driverBreakService.notifyBreakStarted(
      updated,
      schedule?.city ?? null,
      durationMinutes
    );

    const team = await this.teamRepo.findById(updated.teamId);
    return this.routeStopEnrichment.enrichRoute(updated, {
      teamName: team?.name,
      teamCode: team?.code,
    });
  }
}
