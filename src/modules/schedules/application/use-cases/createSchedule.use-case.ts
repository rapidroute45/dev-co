import { AppError } from '../../../../shared/errors/app-error';
import { ScheduleStatus, SCHEDULE_STATUSES } from '../../../../shared/constants/scheduleStatuses';
import { Schedule } from '../../domain/entities/schedule.entity';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { CreateStoreUseCase } from '../../../stores/application/use-cases/createStore.use-case';
import { CreateScheduleDTO } from '../dto/create-schedule.dto';
import { parseFutureScheduleDate } from '../utils/scheduleDate';
import { mapScheduleToResponse } from '../mappers/scheduleResponse.mapper';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';
import { UserRole } from '../../../../shared/constants/roles';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { resolveManagerAndAdminRecipientIds } from '../../../../shared/services/routeOpsRecipients.service';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { formatScheduleDate } from '../utils/scheduleDate';

export class CreateScheduleUseCase {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private notificationService: NotificationService,
    private userRepo: IUserRepository
  ) {}

  async execute(dto: CreateScheduleDTO, createdByUserId: string, actor?: CityActor) {
    const city = dto.city?.trim();
    const state = dto.state?.trim();
    if (!city) throw new AppError('City is required.', 400);
    if (!state) throw new AppError('State is required.', 400);
    enforceActorCity(actor, city);

    const date = parseFutureScheduleDate(dto.date);

    let storeId = dto.storeId;
    let storeResponse = null;

    if (dto.store) {
      if (actor?.role === UserRole.DISPATCH_TEAM) {
        throw new AppError('You do not have permission to create stores.', 403);
      }
      const createStore = new CreateStoreUseCase(this.storeRepo);
      storeResponse = await createStore.execute(
        {
          storeName: dto.store.storeName,
          city: dto.store.city ?? city,
          state: dto.store.state ?? state,
          address: dto.store.address,
          activeStatus: dto.store.activeStatus,
        },
        actor
      );
      storeId = storeResponse.id;
    }

    if (!storeId) {
      throw new AppError('storeId or inline store object is required.', 400);
    }

    const storeEntity = storeResponse
      ? null
      : await this.storeRepo.findById(storeId);
    const store = storeResponse ?? (storeEntity ? mapStoreToResponse(storeEntity) : null);
    if (!store) throw new AppError('Store not found.', 404);

    const status = dto.status ?? ScheduleStatus.DRAFT;
    if (!SCHEDULE_STATUSES.includes(status)) {
      throw new AppError('Invalid schedule status.', 400);
    }

    const schedule = new Schedule({
      date,
      city,
      state,
      storeId,
      createdBy: createdByUserId,
      status,
      notes: dto.notes?.trim() || null,
    });

    const saved = await this.scheduleRepo.save(schedule);

    if (actor?.role === UserRole.DISPATCH_TEAM && saved.id) {
      const actorUser = await this.userRepo.findById(createdByUserId);
      const actorName = resolveDisplayName(actorUser?.fullName, actorUser?.email ?? 'Dispatch team');
      const recipientIds = await resolveManagerAndAdminRecipientIds(this.userRepo, [
        createdByUserId,
      ]);
      await this.notificationService.notifyScheduleCreated({
        recipientIds,
        scheduleId: saved.id,
        storeName: store.storeName ?? 'Store',
        city,
        state,
        scheduleDate: formatScheduleDate(date),
        actorName,
      });
    }

    return mapScheduleToResponse(saved, store, []);
  }
}
