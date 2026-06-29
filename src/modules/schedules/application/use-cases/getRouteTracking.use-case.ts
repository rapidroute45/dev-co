import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { enforceActorCity } from '../../../../shared/services/cityScope.service';
import { scheduleGeocodeContext } from '../utils/geocodeContext';
import { geocodeMissingRouteStops } from '../services/routeStopGeo.service';
import { RouteStopEnrichmentService } from '../services/routeStopEnrichment.service';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';

export class GetRouteTrackingUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private scheduleRepo: IScheduleRepository,
    private storeRepo: IStoreRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository,
    private routeStopEnrichment: RouteStopEnrichmentService
  ) {}

  private assertTrackingViewer(actor?: {
    role: UserRole | null;
    assignedCity?: string | null;
    assignedCities?: string[] | null;
  }) {
    if (
      actor?.role !== UserRole.ADMIN &&
      actor?.role !== UserRole.DISPATCH_MANAGER &&
      actor?.role !== UserRole.DISPATCH_TEAM
    ) {
      throw new AppError('Access denied.', 403);
    }
  }

  async execute(
    routeId: string,
    actor?: {
      role: UserRole | null;
      assignedCity?: string | null;
      assignedCities?: string[] | null;
    }
  ) {
    this.assertTrackingViewer(actor);

    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);

    const schedule = await this.scheduleRepo.findById(route.scheduleId);
    if (schedule) enforceActorCity(actor, schedule.city);

    if (schedule && route.id) {
      try {
        const store = schedule.storeId
          ? await this.storeRepo.findById(String(schedule.storeId))
          : null;
        await geocodeMissingRouteStops({
          routeStopRepo: this.routeStopRepo,
          routeId: route.id,
          geocodeContext: scheduleGeocodeContext({
            city: schedule.city,
            state: schedule.state,
            storeAddress: store?.address ?? null,
            storeState: store?.state ?? null,
          }),
        });
      } catch (error) {
        console.error(`Geocoding stops for tracking route ${routeId} failed`, error);
      }
    }

    const team = await this.teamRepo.findById(route.teamId);
    const driver = route.driverId ? await this.userRepo.findById(route.driverId) : null;

    const enriched = await this.routeStopEnrichment.enrichRoute(
      route,
      {
        teamName: team?.name,
        teamCode: team?.code,
        driverEmail: driver?.email,
        driverName: driver ? resolveDisplayName(driver.fullName, driver.email) : null,
      },
      schedule
        ? {
            geocodeContext: scheduleGeocodeContext({
              city: schedule.city,
              state: schedule.state,
              storeState: schedule.state,
            }),
          }
        : undefined
    );

    const locationTrail =
      route.driverRoutePath && route.driverRoutePath.length > 0
        ? route.driverRoutePath.map((point) => ({
            lat: point.lat,
            lng: point.lng,
            recordedAt: point.recordedAt,
          }))
        : route.driverLat != null && route.driverLng != null
          ? [
              {
                lat: route.driverLat,
                lng: route.driverLng,
                recordedAt: route.driverLocationAt,
              },
            ]
          : [];

    return {
      route: enriched,
      scheduleCity: schedule?.city ?? null,
      scheduleState: schedule?.state ?? null,
      pickup: enriched.pickup ?? null,
      dropoffs: enriched.dropoffs ?? [],
      progress: enriched.progress ?? null,
      locationTrail,
      driverRouteSegmentStopId: route.driverRouteSegmentStopId ?? null,
      driverRouteProgressIndex: route.driverRouteProgressIndex ?? null,
    };
  }
}
