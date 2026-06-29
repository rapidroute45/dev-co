import { AppError } from '../../../../shared/errors/app-error';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { DeliveryVerification } from '../../../../shared/constants/deliveryVerification';
import { OpsVerificationStatus } from '../../../../shared/constants/opsVerification';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { computeOvertimeHours } from '../utils/routeOvertime';
import { resolveRouteTimingFromStops } from '../utils/routeDuration';
import { emitRouteUpdated } from '../../../chat/socket/chat.socket';
import type { Route } from '../../domain/entities/route.entity';

/**
 * Finishes in-progress routes when every dropoff is delivered or returned.
 * Used after driver actions and when ops loads schedules (reconcile stuck routes).
 */
export class RouteAutoCompleteService {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository
  ) {}

  async maybeComplete(routeId: string): Promise<Route | null> {
    const route = await this.routeRepo.findById(routeId);
    if (
      !route ||
      (route.status !== RouteStatus.IN_PROGRESS && route.status !== RouteStatus.ACTIVE)
    ) {
      return null;
    }

    const stops = await this.routeStopRepo.findByRouteId(routeId);
    const dropoffs = stops.filter((s) => s.type === 'dropoff');
    if (dropoffs.length === 0) return null;

    const pending = dropoffs.filter((s) => s.status === RouteStopStatus.PENDING);
    if (pending.length > 0) return null;

    return this.finalize(routeId, route, dropoffs);
  }

  private async finalize(
    routeId: string,
    route: Route,
    dropoffs: Awaited<ReturnType<IRouteStopRepository['findByRouteId']>>
  ): Promise<Route> {
    const { startedAt, completedAt } = resolveRouteTimingFromStops(route, dropoffs);
    const overtimeHours = computeOvertimeHours({
      arrivalMinutes: route.arrivalMinutes,
      departureMinutes: route.departureMinutes,
      startedAt,
      completedAt,
    });

    const updated = await this.routeRepo.update(routeId, {
      status: RouteStatus.COMPLETED,
      deliveryVerification: DeliveryVerification.PENDING,
      opsVerificationStatus: OpsVerificationStatus.PENDING,
      totalMiles: route.mileage ?? route.totalMiles,
      startedAt,
      completedAt,
      overtimeHours,
      driverRoutePath: [],
      driverDwellAnchorLat: null,
      driverDwellAnchorLng: null,
      driverDwellStartedAt: null,
      driverDwellAlertSentAt: null,
      driverLocationBackgroundSharing: false,
    });
    if (!updated) throw new AppError('Failed to complete route.', 500);

    emitRouteUpdated({
      routeId,
      scheduleId: route.scheduleId,
      action: 'updated',
      driverIds: route.driverId ? [route.driverId] : [],
    });

    return updated;
  }
}
