import { AppError } from '../../../../shared/errors/app-error';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { DriverLocationRepository } from '../../infrastructure/repositories/driverLocation.repository';

export class DeleteRouteUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private routeStopRepo: IRouteStopRepository,
    private driverLocationRepo: DriverLocationRepository
  ) {}

  async execute(routeId: string) {
    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);

    await this.routeStopRepo.deleteByRouteId(routeId);
    await this.driverLocationRepo.deleteByRouteId(routeId);
    const deleted = await this.routeRepo.delete(routeId);
    if (!deleted) throw new AppError('Failed to delete route.', 500);

    return { success: true, message: 'Route deleted successfully.' };
  }
}
