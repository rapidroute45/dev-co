import { ScheduleStatus } from '../../../../shared/constants/scheduleStatuses';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';

const ROUTE_COMMITTED_STATUSES = [
  RouteStatus.ACTIVE,
  RouteStatus.IN_PROGRESS,
  RouteStatus.COMPLETED,
];

/**
 * Schedule becomes `active` only when every route is assigned and accepted
 * (route status active / in_progress / completed). Otherwise stays `pending`
 * once published (not draft).
 */
export class ScheduleActivationService {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private routeRepo: IRouteRepository
  ) {}

  async syncFromRoutes(scheduleId: string): Promise<void> {
    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule) return;

    if (
      schedule.status === ScheduleStatus.CANCELLED ||
      schedule.status === ScheduleStatus.COMPLETED ||
      schedule.status === ScheduleStatus.DRAFT
    ) {
      return;
    }

    const routes = await this.routeRepo.findManyByScheduleId(scheduleId);
    if (routes.length === 0) return;

    const hasUnassigned = routes.some((r) => !r.driverId);
    const hasAwaitingAcceptance = routes.some(
      (r) =>
        r.driverId &&
        (r.status === RouteStatus.PENDING || r.status === RouteStatus.ASSIGNED)
    );
    const allCommitted = routes.every((r) => ROUTE_COMMITTED_STATUSES.includes(r.status));

    if (!hasUnassigned && !hasAwaitingAcceptance && allCommitted) {
      if (schedule.status !== ScheduleStatus.ACTIVE) {
        await this.scheduleRepo.update(scheduleId, { status: ScheduleStatus.ACTIVE });
      }
      return;
    }

    if (
      schedule.status === ScheduleStatus.ACTIVE ||
      hasUnassigned ||
      hasAwaitingAcceptance
    ) {
      if (schedule.status !== ScheduleStatus.PENDING) {
        await this.scheduleRepo.update(scheduleId, { status: ScheduleStatus.PENDING });
      }
    }
  }
}
