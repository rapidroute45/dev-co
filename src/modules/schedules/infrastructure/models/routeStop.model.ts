import { Schema, model, Types } from 'mongoose';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';

export const ROUTE_STOP_TYPES = ['pickup', 'dropoff'] as const;
export type RouteStopType = (typeof ROUTE_STOP_TYPES)[number];

const RouteStopSchema = new Schema(
  {
    routeId: { type: Types.ObjectId, ref: 'Route', required: true, index: true },
    scheduleId: { type: Types.ObjectId, ref: 'Schedule', required: true, index: true },
    sequence: { type: Number, required: true },
    type: { type: String, enum: ROUTE_STOP_TYPES, required: true },
    name: { type: String, trim: true, required: true },
    address: { type: String, trim: true, required: true },
    status: {
      type: String,
      enum: Object.values(RouteStopStatus),
      default: RouteStopStatus.PENDING,
    },
    accessCode: { type: String, trim: true, default: null },
    deliveryPhotoUrl: { type: String, default: null },
    returnReason: { type: String, trim: true, default: null },
    returnReasonCustom: { type: String, trim: true, default: null },
    completedAt: { type: Date, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    /** Geocoded delivery address (not overwritten by driver GPS). */
    destinationLat: { type: Number, default: null },
    destinationLng: { type: Number, default: null },
    /** Driver GPS when they first entered the stop approach zone. */
    proximityAnchorLat: { type: Number, default: null },
    proximityAnchorLng: { type: Number, default: null },
    /** When driver first entered the stop approach zone while pending. */
    proximityEnteredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RouteStopSchema.index({ routeId: 1, sequence: 1 }, { unique: true });

export const RouteStopModel = model('RouteStop', RouteStopSchema);
