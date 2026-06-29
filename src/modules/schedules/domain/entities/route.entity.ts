import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { DeliveryVerification } from '../../../../shared/constants/deliveryVerification';
import { OpsVerificationStatus } from '../../../../shared/constants/opsVerification';
import {
  DEFAULT_ROUTE_CATEGORY,
  RouteCategory,
} from '../../../../shared/constants/routeCategories';

export interface RouteProps {
  id?: string;
  scheduleId: string;
  scheduleDate: Date;
  teamId: string;
  driverId: string | null;
  routeName?: string | null;
  routeCategory?: RouteCategory;
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
  driverRouteSegmentStopId?: string | null;
  driverRouteProgressIndex?: number | null;
  driverActiveSegmentPolyline?: { lat: number; lng: number }[];
  driverSegmentVersion?: number | null;
  driverSegmentReroutedAt?: Date | null;
  driverDwellAnchorLat?: number | null;
  driverDwellAnchorLng?: number | null;
  driverDwellStartedAt?: Date | null;
  driverDwellAlertSentAt?: Date | null;
  driverOffRouteAlertSentAt?: Date | null;
  driverLocationStaleAlertSentAt?: Date | null;
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
      routeCategory: props.routeCategory ?? DEFAULT_ROUTE_CATEGORY,
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
  get routeCategory() {
    return this.props.routeCategory ?? DEFAULT_ROUTE_CATEGORY;
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
  get driverLocationIngestedAt() {
    return this.props.driverLocationIngestedAt ?? null;
  }
  get driverLocationBackgroundSharing() {
    return Boolean(this.props.driverLocationBackgroundSharing);
  }
  get startedAt() {
    return this.props.startedAt ?? null;
  }
  get completedAt() {
    return this.props.completedAt ?? null;
  }
  get deliveryVerification() {
    return this.props.deliveryVerification ?? null;
  }
  get overtimeHours() {
    return this.props.overtimeHours ?? 0;
  }
  get opsVerificationStatus() {
    return this.props.opsVerificationStatus ?? null;
  }
  get teamVerifiedAt() {
    return this.props.teamVerifiedAt ?? null;
  }
  get teamVerifiedBy() {
    return this.props.teamVerifiedBy ?? null;
  }
  get managerVerifiedAt() {
    return this.props.managerVerifiedAt ?? null;
  }
  get managerVerifiedBy() {
    return this.props.managerVerifiedBy ?? null;
  }
  get driverRoutePath() {
    return this.props.driverRoutePath ?? [];
  }
  get driverRouteSegmentStopId() {
    return this.props.driverRouteSegmentStopId ?? null;
  }
  get driverRouteProgressIndex() {
    return this.props.driverRouteProgressIndex ?? null;
  }
  get driverActiveSegmentPolyline() {
    return this.props.driverActiveSegmentPolyline ?? [];
  }
  get driverSegmentVersion() {
    return this.props.driverSegmentVersion ?? null;
  }
  get driverSegmentReroutedAt() {
    return this.props.driverSegmentReroutedAt ?? null;
  }
  get driverDwellAnchorLat() {
    return this.props.driverDwellAnchorLat ?? null;
  }
  get driverDwellAnchorLng() {
    return this.props.driverDwellAnchorLng ?? null;
  }
  get driverDwellStartedAt() {
    return this.props.driverDwellStartedAt ?? null;
  }
  get driverDwellAlertSentAt() {
    return this.props.driverDwellAlertSentAt ?? null;
  }
  get driverOffRouteAlertSentAt() {
    return this.props.driverOffRouteAlertSentAt ?? null;
  }
  get driverLocationStaleAlertSentAt() {
    return this.props.driverLocationStaleAlertSentAt ?? null;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
