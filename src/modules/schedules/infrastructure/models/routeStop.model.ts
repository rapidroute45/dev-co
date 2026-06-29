import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';

export const ROUTE_STOP_TYPES = ['pickup', 'dropoff'] as const;
export type RouteStopType = (typeof ROUTE_STOP_TYPES)[number];

export interface RouteStopDocument {
  _id: Types.ObjectId;
  routeId: Types.ObjectId;
  scheduleId: Types.ObjectId;
  sequence: number;
  type: RouteStopType;
  name: string;
  address: string;
  status?: RouteStopStatus;
  accessCode?: string | null;
  deliveryPhotoUrl?: string | null;
  returnReason?: string | null;
  returnReasonCustom?: string | null;
  completedAt?: Date | null;
  lat?: number | null;
  lng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  placeId?: string | null;
  proximityAnchorLat?: number | null;
  proximityAnchorLng?: number | null;
  proximityEnteredAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

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
    destinationLat: { type: Number, default: null },
    destinationLng: { type: Number, default: null },
    placeId: { type: String, trim: true, default: null },
    proximityAnchorLat: { type: Number, default: null },
    proximityAnchorLng: { type: Number, default: null },
    proximityEnteredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RouteStopSchema.index({ routeId: 1, sequence: 1 }, { unique: true });

export const RouteStopModel = createScopedModel<RouteStopDocument>('RouteStop', RouteStopSchema);
