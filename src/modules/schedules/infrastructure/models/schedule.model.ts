import { Schema, model, Types } from 'mongoose';
import { ScheduleStatus } from '../../../../shared/constants/scheduleStatuses';

const ScheduleSchema = new Schema(
  {
    date: { type: Date, required: true, index: true },
    city: { type: String, required: true, trim: true, index: true },
    state: { type: String, required: true, trim: true, index: true },
    storeId: { type: Types.ObjectId, ref: 'Store', required: true, index: true },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: Object.values(ScheduleStatus),
      default: ScheduleStatus.DRAFT,
      index: true,
    },
    notes: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

ScheduleSchema.index({ date: 1, city: 1, state: 1 });
ScheduleSchema.index({ createdBy: 1, date: -1 });

export const ScheduleModel = model('Schedule', ScheduleSchema);
