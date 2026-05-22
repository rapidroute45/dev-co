import { AppError } from '../../../../shared/errors/app-error';
import { IScheduleRepository, ScheduleListFilters } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { ScheduleStatus } from '../../../../shared/constants/scheduleStatuses';
import { mapScheduleToResponse } from '../mappers/scheduleResponse.mapper';
import { mapStoreToResponse } from '../../../stores/application/mappers/storeResponse.mapper';

export class ListSchedulesUseCase {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private routeRepo: IRouteRepository
  ) {}

  async execute(query: Record<string, string>) {
    const date = query.date?.trim();
    if (!date) {
      throw new AppError('date query parameter is required (YYYY-MM-DD).', 400);
    }

    const filters: ScheduleListFilters = {
      date,
      city: query.city?.trim() || undefined,
      state: query.state?.trim() || undefined,
      storeId: query.storeId?.trim() || undefined,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
    };
    if (query.status && Object.values(ScheduleStatus).includes(query.status as ScheduleStatus)) {
      filters.status = query.status as ScheduleStatus;
    }

    const { items, total } = await this.scheduleRepo.findMany(filters);

    const data = await Promise.all(
      items.map(async (schedule) => {
        const [store, routeCount, pendingRouteCount] = await Promise.all([
          this.storeRepo.findById(schedule.storeId),
          this.routeRepo.countByScheduleId(schedule.id!),
          this.routeRepo.countPendingRoutesByScheduleId(schedule.id!),
        ]);
        return mapScheduleToResponse(
          schedule,
          store ? mapStoreToResponse(store) : null,
          [],
          { routeCount, pendingRouteCount }
        );
      })
    );

    return { items: data, total, page: filters.page ?? 1, limit: filters.limit ?? 20 };
  }
}
