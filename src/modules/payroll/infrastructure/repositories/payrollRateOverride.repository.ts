import { Types } from 'mongoose';
import {
  PayrollRateOverride,
  PayrollRateOverrideProps,
} from '../../domain/entities/payrollRateOverride.entity';
import {
  PayrollRateOverrideDocument,
  PayrollRateOverrideModel,
} from '../models/payrollRateOverride.model';

function mapDoc(doc: PayrollRateOverrideDocument): PayrollRateOverride {
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
    const doc = await PayrollRateOverrideModel.findOne({
      storeId: new Types.ObjectId(storeId),
    });
    return doc ? mapDoc(doc) : null;
  }

  async findByStoreIds(storeIds: string[]): Promise<PayrollRateOverride[]> {
    if (storeIds.length === 0) return [];
    const docs = await PayrollRateOverrideModel.find({
      storeId: { $in: storeIds.map((id) => new Types.ObjectId(id)) },
    });
    return docs.map((doc) => mapDoc(doc));
  }

  async upsert(
    storeId: string,
    patch: Pick<
      PayrollRateOverrideProps,
      'smallRouteRate' | 'mediumRouteRate' | 'fullRouteRate'
    > & { updatedBy: string }
  ): Promise<PayrollRateOverride> {
    const storeOid = new Types.ObjectId(storeId);
    const doc = await PayrollRateOverrideModel.findOneAndUpdate(
      { storeId: storeOid },
      {
        storeId: storeOid,
        smallRouteRate: patch.smallRouteRate,
        mediumRouteRate: patch.mediumRouteRate,
        fullRouteRate: patch.fullRouteRate,
        updatedBy: new Types.ObjectId(patch.updatedBy),
      },
      { upsert: true, returnDocument: 'after' }
    );
    if (!doc) throw new Error('Failed to save payroll rates');
    return mapDoc(doc);
  }

  async deleteByStoreId(storeId: string): Promise<boolean> {
    const result = await PayrollRateOverrideModel.deleteOne({
      storeId: new Types.ObjectId(storeId),
    });
    return result.deletedCount > 0;
  }
}
