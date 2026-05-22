import { AppError } from '../../../../shared/errors/app-error';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { ScheduleActivationService } from '../services/scheduleActivation.service';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';

export class AcceptRouteUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository,
    private scheduleActivation: ScheduleActivationService,
    private routeStopEnrichment: RouteStopEnrichmentService
  ) {}

  async execute(routeId: string, driverUserId: string) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);

    if (route.driverId !== driverUserId) {
      throw new AppError('Only the offered driver can accept this route.', 403);
    }

    if (route.status === RouteStatus.ACTIVE) {
      return this.mapWithExtras(route);
    }

    if (route.status !== RouteStatus.PENDING && route.status !== RouteStatus.ASSIGNED) {
      throw new AppError('This route cannot be accepted in its current state.', 400);
    }

    const updated = await this.routeRepo.update(routeId, { status: RouteStatus.ACTIVE });
    if (!updated) throw new AppError('Failed to accept route.', 500);

    await this.scheduleActivation.syncFromRoutes(updated.scheduleId);

    return this.mapWithExtras(updated);
  }

  private async mapWithExtras(route: NonNullable<Awaited<ReturnType<IRouteRepository['findById']>>>) {
    const [team, driver, schedule] = await Promise.all([
      this.teamRepo.findById(route.teamId),
      route.driverId ? this.userRepo.findById(route.driverId) : null,
      this.scheduleRepo.findById(route.scheduleId),
    ]);
    const store = schedule ? await this.storeRepo.findById(schedule.storeId) : null;

    const enriched = await this.routeStopEnrichment.enrichRoute(route, {
      teamName: team?.name,
      teamCode: team?.code,
      driverEmail: driver?.email,
      driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : null,
    });

    return { ...enriched, storeName: store?.storeName };
  }
}
