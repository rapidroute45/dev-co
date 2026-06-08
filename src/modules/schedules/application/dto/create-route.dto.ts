import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { RouteCategory } from '../../../../shared/constants/routeCategories';

export interface CreateRouteDTO {
  scheduleId: string;
  teamId: string;
  driverId?: string;
  routeName?: string;
  routeCategory?: RouteCategory;
  location?: string;
  vehicleType?: string;
  mileage?: number;
  stops?: number;
  /** Pickup location (defaults to schedule store if omitted). */
  pickupDetail?: {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    placeId?: string;
  };
  /** Dropoff stops in delivery order. */
  stopDetails?: {
    name: string;
    address: string;
    accessCode?: string;
    lat?: number;
    lng?: number;
    placeId?: string;
  }[];
  arrivalTime: string;
  departureTime: string;
  status?: RouteStatus;
  notes?: string;
}
