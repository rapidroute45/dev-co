import { Types } from 'mongoose';
import {
  StoreBillingRateOverride,
  StoreBillingRateOverrideProps,
} from '../../domain/entities/storeBillingRateOverride.entity';
import {
  StoreBillingRateOverrideDocument,
  StoreBillingRateOverrideModel,
} from '../models/storeBillingRateOverride.model';

function mapDoc(doc: StoreBillingRateOverrideDocument): StoreBillingRateOverride {
  return new StoreBillingRateOverride({
    id: doc._id.toString(),
    storeId: doc.storeId.toString(),
    smallRouteRate: doc.smallRouteRate,
    mediumRouteRate: doc.mediumRouteRate,
    fullRouteRate: doc.fullRouteRate,
    overtimeHourlyRate: doc.overtimeHourlyRate ?? null,
    weeklyPerformanceIncentive: doc.weeklyPerformanceIncentive ?? null,
    updatedBy: doc.updatedBy?.toString() ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class StoreBillingRateOverrideRepository {
  async findByStoreId(storeId: string): Promise<StoreBillingRateOverride | null> {
    const doc = await StoreBillingRateOverrideModel.findOne({
      storeId: new Types.ObjectId(storeId),
    });
    return doc ? mapDoc(doc) : null;
  }

  async findByStoreIds(storeIds: string[]): Promise<StoreBillingRateOverride[]> {
    if (storeIds.length === 0) return [];
    const docs = await StoreBillingRateOverrideModel.find({
      storeId: { $in: storeIds.map((id) => new Types.ObjectId(id)) },
    });
    return docs.map((doc) => mapDoc(doc));
  }

  async upsert(
    storeId: string,
    patch: Pick<
      StoreBillingRateOverrideProps,
      | 'smallRouteRate'
      | 'mediumRouteRate'
      | 'fullRouteRate'
      | 'overtimeHourlyRate'
      | 'weeklyPerformanceIncentive'
    > & { updatedBy: string }
  ): Promise<StoreBillingRateOverride> {
    const storeOid = new Types.ObjectId(storeId);
    const doc = await StoreBillingRateOverrideModel.findOneAndUpdate(
      { storeId: storeOid },
      {
        storeId: storeOid,
        smallRouteRate: patch.smallRouteRate,
        mediumRouteRate: patch.mediumRouteRate,
        fullRouteRate: patch.fullRouteRate,
        overtimeHourlyRate: patch.overtimeHourlyRate ?? null,
        weeklyPerformanceIncentive: patch.weeklyPerformanceIncentive ?? null,
        updatedBy: new Types.ObjectId(patch.updatedBy),
      },
      { upsert: true, returnDocument: 'after' }
    );
    if (!doc) throw new Error('Failed to save store billing rates');
    return mapDoc(doc);
  }

  async deleteByStoreId(storeId: string): Promise<boolean> {
    const result = await StoreBillingRateOverrideModel.deleteOne({
      storeId: new Types.ObjectId(storeId),
    });
    return result.deletedCount > 0;
  }
}
