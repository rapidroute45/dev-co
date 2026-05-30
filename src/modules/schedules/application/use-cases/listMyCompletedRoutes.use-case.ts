import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { formatScheduleDate, parseScheduleDate } from '../utils/scheduleDate';

/**
 * Driver-facing completed routes history. Intentionally contains NO pay,
 * bonus, or deduction data — drivers can only see how many routes they
 * finished and the route details.
 */
export class ListMyCompletedRoutesUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private teamRepo: ITeamRepository
  ) {}

  async execute(driverUserId: string, query: Record<string, string>) {
    const fromDate = query.from?.trim() ? parseScheduleDate(query.from.trim()) : undefined;
    const toDate = query.to?.trim() ? parseScheduleDate(query.to.trim()) : undefined;

    const routes = await this.routeRepo.findCompletedByDriverId(driverUserId, {
      fromDate,
      toDate,
    });

    const teamNameCache = new Map<string, string | undefined>();
    const items = await Promise.all(
      routes.map(async (route) => {
        if (!teamNameCache.has(route.teamId)) {
          const team = await this.teamRepo.findById(route.teamId);
          teamNameCache.set(route.teamId, team?.name);
        }
        const schedule = await this.scheduleRepo.findById(route.scheduleId);
        const store = schedule ? await this.storeRepo.findById(schedule.storeId) : null;

        return {
          id: route.id,
          routeName: route.routeName,
          location: route.location,
          scheduleDate: formatScheduleDate(route.scheduleDate),
          completedAt: route.completedAt ? route.completedAt.toISOString() : null,
          status: route.status,
          deliveryVerification: route.deliveryVerification,
          teamName: teamNameCache.get(route.teamId) ?? null,
          stops: route.stops,
          city: schedule?.city ?? null,
          state: schedule?.state ?? null,
          storeName: store?.storeName ?? null,
        };
      })
    );

    return { items, count: items.length };
  }
}
