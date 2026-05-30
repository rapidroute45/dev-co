import { Schema, model, Types } from 'mongoose';
import { PayrollStatus } from '../../domain/entities/payrollBill.entity';

const RouteLineSchema = new Schema(
  {
    routeId: { type: Types.ObjectId, ref: 'Route', required: true },
    routeName: { type: String, default: null },
    location: { type: String, default: null },
    scheduleDate: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    rate: { type: Number, required: true },
  },
  { _id: false }
);

const DriverLineSchema = new Schema(
  {
    driverId: { type: Types.ObjectId, ref: 'User', required: true },
    driverName: { type: String, required: true },
    routeCount: { type: Number, required: true, default: 0 },
    basePay: { type: Number, required: true, default: 0 },
    bonus: { type: Number, required: true, default: 0 },
    deduction: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    routes: { type: [RouteLineSchema], default: [] },
  },
  { _id: false }
);

const PayrollBillSchema = new Schema(
  {
    teamId: { type: Types.ObjectId, ref: 'Team', required: true, index: true },
    teamName: { type: String, required: true },
    teamNumber: { type: Number, default: 0 },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(PayrollStatus),
      default: PayrollStatus.DRAFT,
      index: true,
    },
    standardRate: { type: Number, required: true },
    lineItems: { type: [DriverLineSchema], default: [] },
    totalAmount: { type: Number, required: true, default: 0 },
    note: { type: String, default: null },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, default: '' },
    submittedAt: { type: Date, default: null },
    reviewedBy: { type: Types.ObjectId, ref: 'User', default: null },
    reviewedByName: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true }
);

PayrollBillSchema.index({ teamId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

export const PayrollBillModel = model('PayrollBill', PayrollBillSchema);
