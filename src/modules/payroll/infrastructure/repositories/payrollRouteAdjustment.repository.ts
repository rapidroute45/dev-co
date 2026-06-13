import { PayrollRouteAdjustmentModel } from '../models/payrollRouteAdjustment.model';

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

function mapDoc(doc: {
  _id: { toString(): string };
  routeId: { toString(): string };
  driverId: { toString(): string };
  teamId: { toString(): string };
  originalAmount: number;
  adjustedAmount: number;
  reason?: string | null;
  adjustedBy: { toString(): string };
  adjustedAt: Date;
}): PayrollRouteAdjustmentRecord {
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
    const doc = await PayrollRouteAdjustmentModel.findOne({ routeId });
    return doc ? mapDoc(doc) : null;
  }

  async findByRouteIds(routeIds: string[]): Promise<PayrollRouteAdjustmentRecord[]> {
    if (routeIds.length === 0) return [];
    const docs = await PayrollRouteAdjustmentModel.find({ routeId: { $in: routeIds } });
    return docs.map(mapDoc);
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
    const doc = await PayrollRouteAdjustmentModel.findOneAndUpdate(
      { routeId: params.routeId },
      {
        driverId: params.driverId,
        teamId: params.teamId,
        originalAmount: params.originalAmount,
        adjustedAmount: params.adjustedAmount,
        reason: params.reason?.trim() || null,
        adjustedBy: params.adjustedBy,
        adjustedAt: new Date(),
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    return mapDoc(doc!);
  }

  async deleteByRouteId(routeId: string): Promise<void> {
    await PayrollRouteAdjustmentModel.deleteOne({ routeId });
  }
}
