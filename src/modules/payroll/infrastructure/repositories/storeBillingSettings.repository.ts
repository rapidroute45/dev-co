import {
  StoreBillingSettings,
  StoreBillingSettingsProps,
} from '../../domain/entities/storeBillingSettings.entity';
import { StoreBillingSettingsModel } from '../models/storeBillingSettings.model';

function mapDoc(doc: {
  _id: { toString(): string };
  smallRouteRate: number;
  mediumRouteRate: number;
  fullRouteRate: number;
  overtimeHourlyRate: number;
  weeklyPerformanceIncentive: number;
  updatedBy?: { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}): StoreBillingSettings {
  return new StoreBillingSettings({
    id: doc._id.toString(),
    smallRouteRate: doc.smallRouteRate,
    mediumRouteRate: doc.mediumRouteRate,
    fullRouteRate: doc.fullRouteRate,
    overtimeHourlyRate: doc.overtimeHourlyRate ?? 30,
    weeklyPerformanceIncentive: doc.weeklyPerformanceIncentive ?? 0,
    updatedBy: doc.updatedBy?.toString() ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

const DEFAULTS: Omit<StoreBillingSettingsProps, 'id'> = {
  smallRouteRate: 200,
  mediumRouteRate: 300,
  fullRouteRate: 400,
  overtimeHourlyRate: 30,
  weeklyPerformanceIncentive: 0,
  updatedBy: null,
};

export class StoreBillingSettingsRepository {
  async getOrCreate(): Promise<StoreBillingSettings> {
    let doc = await StoreBillingSettingsModel.findOne().sort({ createdAt: 1 });
    if (!doc) {
      doc = await StoreBillingSettingsModel.create(DEFAULTS);
    }
    return mapDoc(doc);
  }

  async update(
    patch: Pick<
      StoreBillingSettingsProps,
      | 'smallRouteRate'
      | 'mediumRouteRate'
      | 'fullRouteRate'
      | 'overtimeHourlyRate'
      | 'weeklyPerformanceIncentive'
    > & { updatedBy: string }
  ): Promise<StoreBillingSettings> {
    const existing = await this.getOrCreate();
    const doc = await StoreBillingSettingsModel.findByIdAndUpdate(
      existing.id,
      {
        smallRouteRate: patch.smallRouteRate,
        mediumRouteRate: patch.mediumRouteRate,
        fullRouteRate: patch.fullRouteRate,
        overtimeHourlyRate: patch.overtimeHourlyRate,
        weeklyPerformanceIncentive: patch.weeklyPerformanceIncentive,
        updatedBy: patch.updatedBy,
      },
      { returnDocument: 'after' }
    );
    if (!doc) throw new Error('Failed to update store billing settings');
    return mapDoc(doc);
  }
}
