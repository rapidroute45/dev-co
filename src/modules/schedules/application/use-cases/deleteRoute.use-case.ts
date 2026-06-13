import { AppError } from '../../../../shared/errors/app-error';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { DriverLocationRepository } from '../../infrastructure/repositories/driverLocation.repository';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';
import { emitRouteUpdated } from '../../../chat/socket/chat.socket';
import { TeamLeadScheduleAlertService } from '../services/teamLeadScheduleAlert.service';

export class DeleteRouteUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private driverLocationRepo: DriverLocationRepository,
    private scheduleRepo: IScheduleRepository,
    private teamLeadAlertService: TeamLeadScheduleAlertService
  ) {}

  async execute(routeId: string, actor?: CityActor) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);

    const schedule = await this.scheduleRepo.findById(route.scheduleId);
    if (schedule) enforceActorCity(actor, schedule.city);

    await this.routeStopRepo.deleteByRouteId(routeId);
    await this.driverLocationRepo.deleteByRouteId(routeId);
    const deleted = await this.routeRepo.delete(routeId);
    if (!deleted) throw new AppError('Failed to delete route.', 500);

    if (route.driverId) {
      emitRouteUpdated({
        routeId,
        scheduleId: route.scheduleId,
        action: 'deleted',
        driverIds: [route.driverId],
      });
    }

    if (route.teamId) {
      await this.teamLeadAlertService.notifyRouteDeleted({
        scheduleId: route.scheduleId,
        teamId: route.teamId,
        routeName: route.routeName ?? 'Route',
      });
    } else {
      await this.teamLeadAlertService.syncForSchedule(route.scheduleId);
    }

    return { success: true, message: 'Route deleted successfully.' };
  }
}
