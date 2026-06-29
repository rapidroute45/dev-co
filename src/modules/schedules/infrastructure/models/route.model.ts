import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import {
  DEFAULT_ROUTE_CATEGORY,
  RouteCategory,
} from '../../../../shared/constants/routeCategories';

const RouteSchema = new Schema(
  {
    scheduleId: { type: Types.ObjectId, ref: 'Schedule', required: true, index: true },
    scheduleDate: { type: Date, required: true, index: true },
    teamId: { type: Types.ObjectId, ref: 'Team', required: true, index: true },
    driverId: { type: Types.ObjectId, ref: 'User', default: null, index: true },
    routeName: { type: String, trim: true, default: null },
    routeCategory: {
      type: String,
      enum: Object.values(RouteCategory),
      default: DEFAULT_ROUTE_CATEGORY,
      index: true,
    },
    location: { type: String, trim: true, default: null },
    vehicleType: { type: String, trim: true, default: null },
    mileage: { type: Number, default: null },
    stops: { type: Number, default: null },
    arrivalTime: { type: String, required: true },
    departureTime: { type: String, required: true },
    arrivalMinutes: { type: Number, required: true, index: true },
    departureMinutes: { type: Number, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(RouteStatus),
      default: RouteStatus.PENDING,
      index: true,
    },
    assignedBy: { type: Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true, default: null },
    totalMiles: { type: Number, default: null },
    driverLat: { type: Number, default: null },
    driverLng: { type: Number, default: null },
    driverLocationAt: { type: Date, default: null },
    driverLocationIngestedAt: { type: Date, default: null },
    driverLocationBackgroundSharing: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    deliveryVerification: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: null,
    },
    overtimeHours: { type: Number, default: 0, min: 0 },
    opsVerificationStatus: {
      type: String,
      enum: ['pending', 'team_verified', 'manager_verified', 'rejected', null],
      default: null,
    },
    teamVerifiedAt: { type: Date, default: null },
    teamVerifiedBy: { type: Types.ObjectId, ref: 'User', default: null },
    managerVerifiedAt: { type: Date, default: null },
    managerVerifiedBy: { type: Types.ObjectId, ref: 'User', default: null },
    driverRoutePath: {
      type: [
        {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
          recordedAt: { type: Date, required: true },
        },
      ],
      default: [],
    },
    driverRouteSegmentStopId: { type: String, default: null },
    driverRouteProgressIndex: { type: Number, default: null },
    driverActiveSegmentPolyline: {
      type: [
        {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
        },
      ],
      default: [],
    },
    driverSegmentVersion: { type: Number, default: null },
    driverSegmentReroutedAt: { type: Date, default: null },
    driverDwellAnchorLat: { type: Number, default: null },
    driverDwellAnchorLng: { type: Number, default: null },
    driverDwellStartedAt: { type: Date, default: null },
    driverDwellAlertSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RouteSchema.index({ driverId: 1, scheduleDate: 1, arrivalMinutes: 1, departureMinutes: 1 });
RouteSchema.index({ teamId: 1, scheduleDate: 1 });

export const RouteModel = createScopedModel('Route', RouteSchema);
