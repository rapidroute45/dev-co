import {
  PayrollBill,
  PayrollDriverLine,
  PayrollRouteLine,
  PayrollStatus,
} from '../../domain/entities/payrollBill.entity';
import {
  IPayrollRepository,
  PayrollBillUpdateData,
  PayrollListFilters,
} from '../../domain/interfaces/payroll-repository.interface';
import { PayrollBillModel } from '../models/payrollBill.model';

type RouteLineDoc = {
  routeId: { toString(): string };
  routeName?: string | null;
  location?: string | null;
  scheduleDate: Date;
  completedAt?: Date | null;
  rate: number;
};

type DriverLineDoc = {
  driverId: { toString(): string };
  driverName: string;
  routeCount: number;
  basePay: number;
  bonus: number;
  deduction: number;
  total: number;
  routes?: RouteLineDoc[];
};

type BillDoc = {
  _id: { toString(): string };
  teamId: { toString(): string };
  teamName: string;
  teamNumber?: number | null;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  standardRate: number;
  lineItems?: DriverLineDoc[];
  totalAmount: number;
  note?: string | null;
  createdBy: { toString(): string };
  createdByName?: string | null;
  submittedAt?: Date | null;
  reviewedBy?: { toString(): string } | null;
  reviewedByName?: string | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function mapRouteLine(doc: RouteLineDoc): PayrollRouteLine {
  return {
    routeId: doc.routeId.toString(),
    routeName: doc.routeName ?? null,
    location: doc.location ?? null,
    scheduleDate: doc.scheduleDate,
    completedAt: doc.completedAt ?? null,
    rate: doc.rate,
  };
}

function mapDriverLine(doc: DriverLineDoc): PayrollDriverLine {
  return {
    driverId: doc.driverId.toString(),
    driverName: doc.driverName,
    routeCount: doc.routeCount,
    basePay: doc.basePay,
    bonus: doc.bonus,
    deduction: doc.deduction,
    total: doc.total,
    routes: (doc.routes ?? []).map(mapRouteLine),
  };
}

function mapDoc(doc: BillDoc): PayrollBill {
  return new PayrollBill({
    id: doc._id.toString(),
    teamId: doc.teamId.toString(),
    teamName: doc.teamName,
    teamNumber: doc.teamNumber ?? 0,
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,
    status: doc.status as PayrollStatus,
    standardRate: doc.standardRate,
    lineItems: (doc.lineItems ?? []).map(mapDriverLine),
    totalAmount: doc.totalAmount,
    note: doc.note ?? null,
    createdBy: doc.createdBy.toString(),
    createdByName: doc.createdByName ?? '',
    submittedAt: doc.submittedAt ?? null,
    reviewedBy: doc.reviewedBy?.toString() ?? null,
    reviewedByName: doc.reviewedByName ?? null,
    reviewedAt: doc.reviewedAt ?? null,
    rejectionReason: doc.rejectionReason ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class PayrollBillRepository implements IPayrollRepository {
  async findById(id: string): Promise<PayrollBill | null> {
    const doc = await PayrollBillModel.findById(id).lean<BillDoc>();
    return doc ? mapDoc(doc) : null;
  }

  async findByTeamAndPeriod(
    teamId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<PayrollBill | null> {
    const doc = await PayrollBillModel.findOne({
      teamId,
      periodStart,
      periodEnd,
    }).lean<BillDoc>();
    return doc ? mapDoc(doc) : null;
  }

  async findMany(filters: PayrollListFilters): Promise<PayrollBill[]> {
    const query: Record<string, unknown> = {};
    if (filters.teamId) query.teamId = filters.teamId;
    if (filters.status) query.status = filters.status;
    const docs = await PayrollBillModel.find(query)
      .sort({ periodStart: -1, createdAt: -1 })
      .lean<BillDoc[]>();
    return docs.map(mapDoc);
  }

  async save(bill: PayrollBill): Promise<PayrollBill> {
    const created = await PayrollBillModel.create({
      teamId: bill.teamId,
      teamName: bill.teamName,
      teamNumber: bill.teamNumber,
      periodStart: bill.periodStart,
      periodEnd: bill.periodEnd,
      status: bill.status,
      standardRate: bill.standardRate,
      lineItems: bill.lineItems,
      totalAmount: bill.totalAmount,
      note: bill.note,
      createdBy: bill.createdBy,
      createdByName: bill.createdByName,
    });
    return mapDoc(created.toObject() as unknown as BillDoc);
  }

  async update(
    id: string,
    data: PayrollBillUpdateData
  ): Promise<PayrollBill | null> {
    const patch: Record<string, unknown> = {};
    if (data.lineItems !== undefined) patch.lineItems = data.lineItems;
    if (data.totalAmount !== undefined) patch.totalAmount = data.totalAmount;
    if (data.status !== undefined) patch.status = data.status;
    if (data.note !== undefined) patch.note = data.note;
    if (data.submittedAt !== undefined) patch.submittedAt = data.submittedAt;
    if (data.reviewedBy !== undefined) patch.reviewedBy = data.reviewedBy;
    if (data.reviewedByName !== undefined) patch.reviewedByName = data.reviewedByName;
    if (data.reviewedAt !== undefined) patch.reviewedAt = data.reviewedAt;
    if (data.rejectionReason !== undefined) patch.rejectionReason = data.rejectionReason;

    const doc = await PayrollBillModel.findByIdAndUpdate(id, patch, {
      returnDocument: 'after',
    }).lean<BillDoc>();
    return doc ? mapDoc(doc) : null;
  }
}
