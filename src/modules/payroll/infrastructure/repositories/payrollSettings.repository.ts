import { Types } from 'mongoose';
import {
  PayrollSettings,
  PayrollSettingsProps,
} from '../../domain/entities/payrollSettings.entity';
import {
  PayrollSettingsDocument,
  PayrollSettingsModel,
} from '../models/payrollSettings.model';

function mapDoc(doc: PayrollSettingsDocument): PayrollSettings {
  return new PayrollSettings({
    id: doc._id.toString(),
    smallRouteRate: doc.smallRouteRate,
    mediumRouteRate: doc.mediumRouteRate,
    fullRouteRate: doc.fullRouteRate,
    updatedBy: doc.updatedBy?.toString() ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

const DEFAULTS: Omit<PayrollSettingsProps, 'id'> = {
  smallRouteRate: 200,
  mediumRouteRate: 300,
  fullRouteRate: 400,
  updatedBy: null,
};

export class PayrollSettingsRepository {
  async getOrCreate(): Promise<PayrollSettings> {
    let doc = await PayrollSettingsModel.findOne().sort({ createdAt: 1 });
    if (!doc) {
      doc = await PayrollSettingsModel.create(DEFAULTS);
    }
    return mapDoc(doc);
  }

  async update(
    patch: Pick<PayrollSettingsProps, 'smallRouteRate' | 'mediumRouteRate' | 'fullRouteRate'> & {
      updatedBy: string;
    }
  ): Promise<PayrollSettings> {
    const existing = await this.getOrCreate();
    const doc = await PayrollSettingsModel.findByIdAndUpdate(
      existing.id,
      {
        smallRouteRate: patch.smallRouteRate,
        mediumRouteRate: patch.mediumRouteRate,
        fullRouteRate: patch.fullRouteRate,
        updatedBy: new Types.ObjectId(patch.updatedBy),
      },
      { returnDocument: 'after' }
    );
    if (!doc) throw new Error('Failed to update payroll settings');
    return mapDoc(doc);
  }
}
