import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';
import { RouteDwellStatus } from '../../../../shared/constants/routeDwellStatuses';
import {
  DWELL_RADIUS_METERS,
  DWELL_THRESHOLD_MINUTES,
} from '../../../../shared/constants/dwellDetection';

const RouteDwellSessionSchema = new Schema(
  {
    routeId: { type: Types.ObjectId, ref: 'Route', required: true, index: true },
    driverId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    teamId: { type: Types.ObjectId, ref: 'Team', required: true, index: true },
    teamLeadId: { type: Types.ObjectId, ref: 'User', default: null, index: true },
    centerLat: { type: Number, required: true },
    centerLng: { type: Number, required: true },
    startedAt: { type: Date, required: true, index: true },
    lastSeenAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: Object.values(RouteDwellStatus),
      default: RouteDwellStatus.ACTIVE,
      index: true,
    },
    alertSentAt: { type: Date, default: null },
    alertNotificationId: { type: Types.ObjectId, ref: 'Notification', default: null },
    radiusMeters: { type: Number, default: DWELL_RADIUS_METERS },
    thresholdMinutes: { type: Number, default: DWELL_THRESHOLD_MINUTES },
  },
  { timestamps: true }
);

RouteDwellSessionSchema.index({ routeId: 1, status: 1 });
RouteDwellSessionSchema.index({ teamLeadId: 1, status: 1, lastSeenAt: -1 });

export const RouteDwellSessionModel = createScopedModel('RouteDwellSession', RouteDwellSessionSchema);
