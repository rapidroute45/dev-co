import { AppError } from '../../../../shared/errors/app-error';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';

export class DeleteScheduleUseCase {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository
  ) {}

  async execute(scheduleId: string) {
    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule) throw new AppError('Schedule not found.', 404);

    await this.routeStopRepo.deleteByScheduleId(scheduleId);
    await this.routeRepo.deleteManyByScheduleId(scheduleId);
    const deleted = await this.scheduleRepo.delete(scheduleId);
    if (!deleted) throw new AppError('Failed to delete schedule.', 500);

    return { success: true, message: 'Schedule and its routes deleted successfully.' };
  }
}
