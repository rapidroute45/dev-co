import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

const TeamLeadScheduleAlertSchema = new Schema(
  {
    scheduleId: { type: Types.ObjectId, ref: 'Schedule', required: true, index: true },
    teamId: { type: Types.ObjectId, ref: 'Team', required: true, index: true },
    teamLeadId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    scheduleDate: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    storeName: { type: String, required: true, trim: true },
    routeCount: { type: Number, required: true, default: 0 },
    assignedRouteCount: { type: Number, required: true, default: 0 },
    updateType: {
      type: String,
      enum: ['schedule_updated', 'route_deleted'],
      default: 'schedule_updated',
    },
    deletedRouteName: { type: String, default: null, trim: true },
    seenAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

TeamLeadScheduleAlertSchema.index({ scheduleId: 1, teamId: 1 }, { unique: true });
TeamLeadScheduleAlertSchema.index({ teamLeadId: 1, seenAt: 1, scheduleDate: 1 });

export const TeamLeadScheduleAlertModel = createScopedModel(
  'TeamLeadScheduleAlert',
  TeamLeadScheduleAlertSchema
);
