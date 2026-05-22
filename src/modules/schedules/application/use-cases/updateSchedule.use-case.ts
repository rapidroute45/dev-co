import { AppError } from '../../../../shared/errors/app-error';
import { SCHEDULE_STATUSES, ScheduleStatus } from '../../../../shared/constants/scheduleStatuses';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { parseScheduleDate } from '../utils/scheduleDate';
import { mapScheduleToResponse } from '../mappers/scheduleResponse.mapper';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';

export class UpdateScheduleUseCase {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private routeRepo: IRouteRepository
  ) {}

  async execute(scheduleId: string, dto: Record<string, unknown>) {
    const existing = await this.scheduleRepo.findById(scheduleId);
    if (!existing) throw new AppError('Schedule not found.', 404);

    const patch: Parameters<IScheduleRepository['update']>[1] = {};

    if (dto.date !== undefined) patch.date = parseScheduleDate(String(dto.date));
    if (dto.city !== undefined) patch.city = String(dto.city).trim();
    if (dto.state !== undefined) patch.state = String(dto.state).trim();
    if (dto.storeId !== undefined) {
      const store = await this.storeRepo.findById(String(dto.storeId));
      if (!store) throw new AppError('Store not found.', 404);
      patch.storeId = store.id!;
    }
    if (dto.status !== undefined) {
      const status = String(dto.status) as ScheduleStatus;
      if (!SCHEDULE_STATUSES.includes(status)) {
        throw new AppError('Invalid schedule status.', 400);
      }
      if (status === ScheduleStatus.ACTIVE) {
        const routes = await this.routeRepo.findManyByScheduleId(scheduleId);
        const canActivate =
          routes.length > 0 &&
          routes.every((r) => !r.driverId || r.status === RouteStatus.ACTIVE ||
            r.status === RouteStatus.IN_PROGRESS ||
            r.status === RouteStatus.COMPLETED);
        const awaiting = routes.some(
          (r) =>
            r.driverId &&
            (r.status === RouteStatus.PENDING || r.status === RouteStatus.ASSIGNED)
        );
        if (!canActivate || awaiting) {
          throw new AppError(
            'Schedule cannot be set to active until all assigned drivers have accepted their routes.',
            400
          );
        }
      }
      patch.status = status;
    }
    if (dto.notes !== undefined) patch.notes = dto.notes ? String(dto.notes).trim() : null;

    const updated = await this.scheduleRepo.update(scheduleId, patch);
    if (!updated) throw new AppError('Failed to update schedule.', 500);

    if (patch.date) {
      const routes = await this.routeRepo.findManyByScheduleId(scheduleId);
      await Promise.all(
        routes.map((r) =>
          this.routeRepo.update(r.id!, { scheduleDate: patch.date })
        )
      );
    }

    const store = await this.storeRepo.findById(updated.storeId);
    const routes = await this.routeRepo.findManyByScheduleId(scheduleId);
    return mapScheduleToResponse(
      updated,
      store ? mapStoreToResponse(store) : null,
      []
    );
  }
}
