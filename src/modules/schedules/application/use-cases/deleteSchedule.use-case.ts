import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { ITeamLeadScheduleAlertRepository } from '../../domain/interfaces/team-lead-schedule-alert-repository.interface';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';
import { emitRouteUpdated } from '../../../chat/socket/chat.socket';

const DELETE_SCHEDULE_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

export class DeleteScheduleUseCase {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private teamLeadAlertRepo: ITeamLeadScheduleAlertRepository
  ) {}

  async execute(scheduleId: string, actor?: CityActor) {
    if (!actor?.role || !DELETE_SCHEDULE_ROLES.includes(actor.role)) {
      throw new AppError('Only admin or dispatch manager can delete a schedule.', 403);
    }

    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule) throw new AppError('Schedule not found.', 404);
    enforceActorCity(actor, schedule.city);

    const routes = await this.routeRepo.findManyByScheduleId(scheduleId);

    for (const route of routes) {
      if (!route.id) continue;
      await this.routeStopRepo.deleteByRouteId(route.id);
      if (route.driverId) {
        emitRouteUpdated({
          routeId: route.id,
          scheduleId,
          action: 'deleted',
          driverIds: [route.driverId],
        });
      }
    }

    await this.routeStopRepo.deleteByScheduleId(scheduleId);
    await this.routeRepo.deleteManyByScheduleId(scheduleId);
    await this.teamLeadAlertRepo.deleteByScheduleId(scheduleId);

    const deleted = await this.scheduleRepo.delete(scheduleId);
    if (!deleted) throw new AppError('Failed to delete schedule.', 500);

    return { success: true, message: 'Schedule deleted successfully.' };
  }
}
