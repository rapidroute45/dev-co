import { Route } from '../entities/route.entity';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';

export interface RouteUpdateData {
  teamId?: string;
  driverId?: string | null;
  routeName?: string | null;
  location?: string | null;
  vehicleType?: string | null;
  mileage?: number | null;
  stops?: number | null;
  arrivalTime?: string;
  departureTime?: string;
  arrivalMinutes?: number;
  departureMinutes?: number;
  scheduleDate?: Date;
  status?: RouteStatus;
  notes?: string | null;
  totalMiles?: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
  driverLocationAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  deliveryVerification?: DeliveryVerification | null;
}

export interface RouteListFilters {
  date: string;
  status?: RouteStatus;
  scheduleIds?: string[];
  page?: number;
  limit?: number;
}

export interface IRouteRepository {
  findById(id: string): Promise<Route | null>;
  findMany(filters: RouteListFilters): Promise<{ items: Route[]; total: number }>;
  findManyByScheduleId(scheduleId: string): Promise<Route[]>;
  findPendingOffersForDriver(driverId: string): Promise<Route[]>;
  countByScheduleId(scheduleId: string): Promise<number>;
  countPendingRoutesByScheduleId(scheduleId: string): Promise<number>;
  countByScheduleDate(scheduleDate: Date, status?: RouteStatus): Promise<number>;
  findBusyDriverIdsOnDate(scheduleDate: Date): Promise<string[]>;
  findManyByDriverId(driverId: string, filters?: { fromDate?: Date; toDate?: Date }): Promise<Route[]>;
  findOverlappingForDriver(params: {
    driverId: string;
    scheduleDate: Date;
    arrivalMinutes: number;
    departureMinutes: number;
    excludeRouteId?: string;
  }): Promise<Route[]>;
  save(route: Route): Promise<Route>;
  update(id: string, data: RouteUpdateData): Promise<Route | null>;
  delete(id: string): Promise<boolean>;
  deleteManyByScheduleId(scheduleId: string): Promise<number>;
}
