import { AppError } from '../../../../shared/errors/app-error';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { mapRouteToResponse } from '../mappers/scheduleResponse.mapper';
import { ScheduleActivationService } from '../services/scheduleActivation.service';

export class DeclineRouteUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private teamRepo: ITeamRepository,
    private scheduleActivation: ScheduleActivationService
  ) {}

  async execute(routeId: string, driverUserId: string) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);

    if (route.driverId !== driverUserId) {
      throw new AppError('Only the offered driver can decline this route.', 403);
    }

    if (route.status !== RouteStatus.PENDING && route.status !== RouteStatus.ASSIGNED) {
      throw new AppError('This route cannot be declined in its current state.', 400);
    }

    const updated = await this.routeRepo.update(routeId, {
      driverId: null,
      status: RouteStatus.PENDING,
    });
    if (!updated) throw new AppError('Failed to decline route.', 500);

    await this.scheduleActivation.syncFromRoutes(updated.scheduleId);

    const team = await this.teamRepo.findById(updated.teamId);
    return mapRouteToResponse(updated, {
      teamName: team?.name,
      teamCode: team?.code,
      driverEmail: undefined,
      driverName: null,
    });
  }
}
