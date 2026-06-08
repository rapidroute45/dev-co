import { Schema, model, Types } from 'mongoose';
import { PayrollStatus } from '../../domain/entities/payrollBill.entity';

const ALL_STATUSES = [
  ...Object.values(PayrollStatus),
  'submitted',
  'approved',
  'rejected',
];

const RouteLineSchema = new Schema(
  {
    routeId: { type: Types.ObjectId, ref: 'Route', required: true },
    routeName: { type: String, default: null },
    location: { type: String, default: null },
    scheduleDate: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    rate: { type: Number, required: true },
    routeCategory: { type: String, default: 'SMALL' },
    defaultRate: { type: Number, default: 0 },
    originalAmount: { type: Number, default: 0 },
    hasAdjustment: { type: Boolean, default: false },
    adjustmentReason: { type: String, default: null },
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
    overtime: { type: Number, required: true, default: 0 },
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
      enum: ALL_STATUSES,
      default: PayrollStatus.DRAFT,
      index: true,
    },
    standardRate: { type: Number, required: true },
    lineItems: { type: [DriverLineSchema], default: [] },
    totalAmount: { type: Number, required: true, default: 0 },
    subtotal: { type: Number, default: 0 },
    adjustmentsTotal: { type: Number, default: 0 },
    bonusesTotal: { type: Number, default: 0 },
    deductionsTotal: { type: Number, default: 0 },
    overtimeTotal: { type: Number, default: 0 },
    note: { type: String, default: null },
    teamLeadAcknowledgedAt: { type: Date, default: null },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, default: '' },
    sentToTeamLeadAt: { type: Date, default: null },
    teamLeadNote: { type: String, default: null },
    teamLeadReviewedAt: { type: Date, default: null },
    paymentReceiptUrl: { type: String, default: null },
    paidAt: { type: Date, default: null },
    paidBy: { type: Types.ObjectId, ref: 'User', default: null },
    paidByName: { type: String, default: null },
  },
  { timestamps: true }
);

PayrollBillSchema.index({ teamId: 1, periodStart: 1, periodEnd: 1 });
PayrollBillSchema.index({ teamId: 1, status: 1 });

export const PayrollBillModel = model('PayrollBill', PayrollBillSchema);
