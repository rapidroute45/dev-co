import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export interface InvoiceBillToDocument {
  _id: Types.ObjectId;
  name: string;
  address: string;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const InvoiceBillToSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    address: { type: String, required: true, trim: true },
    updatedBy: { type: Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const InvoiceBillToModel = createScopedModel<InvoiceBillToDocument>(
  'InvoiceBillTo',
  InvoiceBillToSchema
);
