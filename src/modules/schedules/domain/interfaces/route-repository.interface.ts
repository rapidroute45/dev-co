import { Route } from '../entities/route.entity';
import { DeliveryVerification } from '../../../../shared/constants/deliveryVerification';
import { OpsVerificationStatus } from '../../../../shared/constants/opsVerification';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { RouteCategory } from '../../../../shared/constants/routeCategories';

export interface RouteUpdateData {
  teamId?: string;
  driverId?: string | null;
  routeName?: string | null;
  routeCategory?: RouteCategory;
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
  driverLocationIngestedAt?: Date | null;
  driverLocationBackgroundSharing?: boolean;
  startedAt?: Date | null;
  completedAt?: Date | null;
  deliveryVerification?: DeliveryVerification | null;
  overtimeHours?: number;
  opsVerificationStatus?: OpsVerificationStatus | null;
  teamVerifiedAt?: Date | null;
  teamVerifiedBy?: string | null;
  managerVerifiedAt?: Date | null;
  managerVerifiedBy?: string | null;
  driverRoutePath?: { lat: number; lng: number; recordedAt: Date }[];
  driverDwellAnchorLat?: number | null;
  driverDwellAnchorLng?: number | null;
  driverDwellStartedAt?: Date | null;
  driverDwellAlertSentAt?: Date | null;
}

export interface RouteListFilters {
  date: string;
  status?: RouteStatus;
  scheduleIds?: string[];
  teamId?: string;
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
  countByScheduleIds(
    scheduleIds: string[],
    scheduleDate: Date,
    status?: RouteStatus
  ): Promise<number>;
  countByTeamAndScheduleDate(teamId: string, scheduleDate: Date, status?: RouteStatus): Promise<number>;
  findBusyDriverIdsOnDate(scheduleDate: Date): Promise<string[]>;
  findTeamAndDriverIdsByScheduleIds(
    scheduleIds: string[]
  ): Promise<{ teamIds: string[]; driverIds: string[] }>;
  findManyByDriverId(
    driverId: string,
    filters?: { fromDate?: Date; toDate?: Date; status?: RouteStatus | RouteStatus[] }
  ): Promise<Route[]>;
  findCompletedByDriverId(driverId: string, filters?: { fromDate?: Date; toDate?: Date }): Promise<Route[]>;
  findCompletedByTeamInRange(teamId: string, fromDate: Date, toDate: Date): Promise<Route[]>;
  findCompletedByTeamExcludingRouteIds(
    teamId: string,
    excludeRouteIds: string[]
  ): Promise<Route[]>;
  findCompletedByTeamInPeriodExcludingRouteIds(
    teamId: string,
    periodStart: Date,
    periodEnd: Date,
    excludeRouteIds: string[]
  ): Promise<Route[]>;
  findCompletedByScheduleIdsInPeriod(
    scheduleIds: string[],
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<Route[]>;
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
