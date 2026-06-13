import { AppError } from '../../../../shared/errors/app-error';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { DeliveryVerification } from '../../../../shared/constants/deliveryVerification';
import { OpsVerificationStatus } from '../../../../shared/constants/opsVerification';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { DriverLocationRepository } from '../../infrastructure/repositories/driverLocation.repository';
import { DwellDetectionService } from './dwellDetection.service';
import { sumLocationPathMiles } from '../utils/haversine';
import { computeOvertimeHours } from '../utils/routeOvertime';
import { emitRouteUpdated } from '../../../chat/socket/chat.socket';
import type { Route } from '../../domain/entities/route.entity';

/**
 * Finishes in-progress routes when every dropoff is delivered or returned.
 * Used after driver actions and when ops loads schedules (reconcile stuck routes).
 */
export class RouteAutoCompleteService {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private driverLocationRepo: DriverLocationRepository,
    private dwellDetection: DwellDetectionService
  ) {}

  async maybeComplete(routeId: string): Promise<Route | null> {
    const route = await this.routeRepo.findById(routeId);
    if (!route || route.status !== RouteStatus.IN_PROGRESS) return null;

    const stops = await this.routeStopRepo.findByRouteId(routeId);
    const dropoffs = stops.filter((s) => s.type === 'dropoff');
    if (dropoffs.length === 0) return null;

    const pending = dropoffs.filter((s) => s.status === RouteStopStatus.PENDING);
    if (pending.length > 0) return null;

    return this.finalize(routeId, route);
  }

  private async finalize(routeId: string, route: Route): Promise<Route> {
    const path = await this.driverLocationRepo.listByRoute(routeId);
    const totalMiles = sumLocationPathMiles(path);
    const completedAt = new Date();
    const overtimeHours = computeOvertimeHours({
      arrivalMinutes: route.arrivalMinutes,
      departureMinutes: route.departureMinutes,
      startedAt: route.startedAt,
      completedAt,
    });

    const updated = await this.routeRepo.update(routeId, {
      status: RouteStatus.COMPLETED,
      deliveryVerification: DeliveryVerification.PENDING,
      opsVerificationStatus: OpsVerificationStatus.PENDING,
      totalMiles: totalMiles > 0 ? totalMiles : route.mileage,
      completedAt,
      overtimeHours,
    });
    if (!updated) throw new AppError('Failed to complete route.', 500);

    await this.dwellDetection.resolveActiveSessions(routeId);

    emitRouteUpdated({
      routeId,
      scheduleId: route.scheduleId,
      action: 'updated',
      driverIds: route.driverId ? [route.driverId] : [],
    });

    return updated;
  }
}
