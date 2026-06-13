import {
  PayrollRateOverride,
  PayrollRateOverrideProps,
} from '../../domain/entities/payrollRateOverride.entity';
import { PayrollRateOverrideModel } from '../models/payrollRateOverride.model';

function mapDoc(doc: {
  _id: { toString(): string };
  storeId: { toString(): string };
  smallRouteRate: number;
  mediumRouteRate: number;
  fullRouteRate: number;
  updatedBy?: { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}): PayrollRateOverride {
  return new PayrollRateOverride({
    id: doc._id.toString(),
    storeId: doc.storeId.toString(),
    smallRouteRate: doc.smallRouteRate,
    mediumRouteRate: doc.mediumRouteRate,
    fullRouteRate: doc.fullRouteRate,
    updatedBy: doc.updatedBy?.toString() ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class PayrollRateOverrideRepository {
  async findByStoreId(storeId: string): Promise<PayrollRateOverride | null> {
    const doc = await PayrollRateOverrideModel.findOne({ storeId });
    return doc ? mapDoc(doc) : null;
  }

  async findByStoreIds(storeIds: string[]): Promise<PayrollRateOverride[]> {
    if (storeIds.length === 0) return [];
    const docs = await PayrollRateOverrideModel.find({
      storeId: { $in: storeIds },
    });
    return docs.map(mapDoc);
  }

  async upsert(
    storeId: string,
    patch: Pick<
      PayrollRateOverrideProps,
      'smallRouteRate' | 'mediumRouteRate' | 'fullRouteRate'
    > & { updatedBy: string }
  ): Promise<PayrollRateOverride> {
    const doc = await PayrollRateOverrideModel.findOneAndUpdate(
      { storeId },
      {
        storeId,
        smallRouteRate: patch.smallRouteRate,
        mediumRouteRate: patch.mediumRouteRate,
        fullRouteRate: patch.fullRouteRate,
        updatedBy: patch.updatedBy,
      },
      { upsert: true, returnDocument: 'after' }
    );
    if (!doc) throw new Error('Failed to save payroll rates');
    return mapDoc(doc);
  }

  async deleteByStoreId(storeId: string): Promise<boolean> {
    const result = await PayrollRateOverrideModel.deleteOne({ storeId });
    return result.deletedCount > 0;
  }
}
