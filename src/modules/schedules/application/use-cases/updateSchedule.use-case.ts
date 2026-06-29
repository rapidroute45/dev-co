import { AppError } from '../../../../shared/errors/app-error';
import { SCHEDULE_STATUSES, ScheduleStatus } from '../../../../shared/constants/scheduleStatuses';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { parseFutureScheduleDate } from '../utils/scheduleDate';
import { mapScheduleToResponse } from '../mappers/scheduleResponse.mapper';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';
import { UserRole } from '../../../../shared/constants/roles';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { resolveManagerAndAdminRecipientIds } from '../../../../shared/services/routeOpsRecipients.service';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { formatScheduleDate } from '../utils/scheduleDate';

export class UpdateScheduleUseCase {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private routeRepo: IRouteRepository,
    private notificationService: NotificationService,
    private userRepo: IUserRepository
  ) {}

  async execute(
    scheduleId: string,
    dto: Record<string, unknown>,
    actor?: CityActor,
    updatedByUserId?: string
  ) {
    const existing = await this.scheduleRepo.findById(scheduleId);
    if (!existing) throw new AppError('Schedule not found.', 404);
    enforceActorCity(actor, existing.city);

    const patch: Parameters<IScheduleRepository['update']>[1] = {};

    if (dto.date !== undefined) patch.date = parseFutureScheduleDate(String(dto.date));
    if (dto.city !== undefined) {
      const city = String(dto.city).trim();
      enforceActorCity(actor, city);
      patch.city = city;
    }
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

    if (
      actor?.role === UserRole.DISPATCH_TEAM &&
      Object.keys(patch).length > 0 &&
      updatedByUserId
    ) {
      const actorUser = await this.userRepo.findById(updatedByUserId);
      const actorName = resolveDisplayName(actorUser?.fullName, actorUser?.email ?? 'Dispatch team');
      const recipientIds = await resolveManagerAndAdminRecipientIds(this.userRepo, [
        updatedByUserId,
      ]);
      await this.notificationService.notifyScheduleUpdated({
        recipientIds,
        scheduleId,
        storeName: store?.storeName ?? 'Store',
        city: updated.city,
        state: updated.state,
        scheduleDate: formatScheduleDate(updated.date),
        actorName,
      });
    }

    return mapScheduleToResponse(
      updated,
      store ? mapStoreToResponse(store) : null,
      []
    );
  }
}
