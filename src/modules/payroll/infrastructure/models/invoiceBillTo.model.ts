import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

const InvoiceBillToSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    address: { type: String, required: true, trim: true },
    updatedBy: { type: Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const InvoiceBillToModel = createScopedModel('InvoiceBillTo', InvoiceBillToSchema);
