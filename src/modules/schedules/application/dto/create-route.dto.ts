import { RouteStatus } from '../../../../shared/constants/routeStatuses';

export interface CreateRouteDTO {
  scheduleId: string;
  teamId: string;
  driverId?: string;
  routeName?: string;
  location?: string;
  vehicleType?: string;
  mileage?: number;
  stops?: number;
  /** Dropoff stops only; pickup is created from the schedule store. */
  stopDetails?: { name: string; address: string }[];
  arrivalTime: string;
  departureTime: string;
  status?: RouteStatus;
  notes?: string;
}
