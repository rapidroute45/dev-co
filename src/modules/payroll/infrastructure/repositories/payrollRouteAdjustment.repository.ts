import { Types } from 'mongoose';
import {
  PayrollRouteAdjustmentDocument,
  PayrollRouteAdjustmentModel,
} from '../models/payrollRouteAdjustment.model';

export type PayrollRouteAdjustmentRecord = {
  id: string;
  routeId: string;
  driverId: string;
  teamId: string;
  originalAmount: number;
  adjustedAmount: number;
  reason: string | null;
  adjustedBy: string;
  adjustedAt: Date;
};

function mapDoc(doc: PayrollRouteAdjustmentDocument): PayrollRouteAdjustmentRecord {
  return {
    id: doc._id.toString(),
    routeId: doc.routeId.toString(),
    driverId: doc.driverId.toString(),
    teamId: doc.teamId.toString(),
    originalAmount: doc.originalAmount,
    adjustedAmount: doc.adjustedAmount,
    reason: doc.reason ?? null,
    adjustedBy: doc.adjustedBy.toString(),
    adjustedAt: doc.adjustedAt,
  };
}

export class PayrollRouteAdjustmentRepository {
  async findByRouteId(routeId: string): Promise<PayrollRouteAdjustmentRecord | null> {
    const doc = await PayrollRouteAdjustmentModel.findOne({
      routeId: new Types.ObjectId(routeId),
    });
    return doc ? mapDoc(doc) : null;
  }

  async findByRouteIds(routeIds: string[]): Promise<PayrollRouteAdjustmentRecord[]> {
    if (routeIds.length === 0) return [];
    const docs = await PayrollRouteAdjustmentModel.find({
      routeId: { $in: routeIds.map((id) => new Types.ObjectId(id)) },
    });
    return docs.map((doc) => mapDoc(doc));
  }

  async upsert(params: {
    routeId: string;
    driverId: string;
    teamId: string;
    originalAmount: number;
    adjustedAmount: number;
    reason: string | null;
    adjustedBy: string;
  }): Promise<PayrollRouteAdjustmentRecord> {
    const routeOid = new Types.ObjectId(params.routeId);
    const doc = await PayrollRouteAdjustmentModel.findOneAndUpdate(
      { routeId: routeOid },
      {
        routeId: routeOid,
        driverId: new Types.ObjectId(params.driverId),
        teamId: new Types.ObjectId(params.teamId),
        originalAmount: params.originalAmount,
        adjustedAmount: params.adjustedAmount,
        reason: params.reason?.trim() || null,
        adjustedBy: new Types.ObjectId(params.adjustedBy),
        adjustedAt: new Date(),
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    if (!doc) throw new Error('Failed to save payroll route adjustment');
    return mapDoc(doc);
  }

  async deleteByRouteId(routeId: string): Promise<void> {
    await PayrollRouteAdjustmentModel.deleteOne({
      routeId: new Types.ObjectId(routeId),
    });
  }
}
