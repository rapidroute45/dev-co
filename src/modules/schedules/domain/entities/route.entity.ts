import { RouteStatus } from '../../../../shared/constants/routeStatuses';

export interface RouteProps {
  id?: string;
  scheduleId: string;
  scheduleDate: Date;
  teamId: string;
  driverId: string | null;
  routeName?: string | null;
  location?: string | null;
  vehicleType?: string | null;
  mileage?: number | null;
  stops?: number | null;
  arrivalTime: string;
  departureTime: string;
  arrivalMinutes: number;
  departureMinutes: number;
  status: RouteStatus;
  assignedBy: string;
  notes?: string | null;
  totalMiles?: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
  driverLocationAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Route {
  private props: RouteProps;

  constructor(props: RouteProps) {
    this.props = {
      ...props,
      driverId: props.driverId ?? null,
      routeName: props.routeName ?? null,
      location: props.location ?? null,
      vehicleType: props.vehicleType ?? null,
      mileage: props.mileage ?? null,
      stops: props.stops ?? null,
      notes: props.notes ?? null,
      status: props.status ?? RouteStatus.PENDING,
    };
  }

  get id() {
    return this.props.id;
  }
  get scheduleId() {
    return this.props.scheduleId;
  }
  get scheduleDate() {
    return this.props.scheduleDate;
  }
  get teamId() {
    return this.props.teamId;
  }
  get driverId() {
    return this.props.driverId;
  }
  get routeName() {
    return this.props.routeName ?? null;
  }
  get location() {
    return this.props.location ?? null;
  }
  get vehicleType() {
    return this.props.vehicleType ?? null;
  }
  get mileage() {
    return this.props.mileage ?? null;
  }
  get stops() {
    return this.props.stops ?? null;
  }
  get arrivalTime() {
    return this.props.arrivalTime;
  }
  get departureTime() {
    return this.props.departureTime;
  }
  get arrivalMinutes() {
    return this.props.arrivalMinutes;
  }
  get departureMinutes() {
    return this.props.departureMinutes;
  }
  get status() {
    return this.props.status;
  }
  get assignedBy() {
    return this.props.assignedBy;
  }
  get notes() {
    return this.props.notes ?? null;
  }
  get totalMiles() {
    return this.props.totalMiles ?? null;
  }
  get driverLat() {
    return this.props.driverLat ?? null;
  }
  get driverLng() {
    return this.props.driverLng ?? null;
  }
  get driverLocationAt() {
    return this.props.driverLocationAt ?? null;
  }
  get startedAt() {
    return this.props.startedAt ?? null;
  }
  get completedAt() {
    return this.props.completedAt ?? null;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
