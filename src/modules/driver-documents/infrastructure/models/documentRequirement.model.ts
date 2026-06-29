import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export type DocumentRequirementCategory = 'identity' | 'vehicle' | 'compliance';

export interface DocumentRequirementDocument {
  _id: Types.ObjectId;
  key: string;
  title: string;
  description?: string | null;
  category: DocumentRequirementCategory;
  requiresExpiry: boolean;
  requiresReferenceNumber: boolean;
  referenceLabel?: string | null;
  requiresFile: boolean;
  active: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const documentRequirementSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    category: {
      type: String,
      enum: ['identity', 'vehicle', 'compliance'],
      default: 'compliance',
    },
    requiresExpiry: { type: Boolean, default: true },
    requiresReferenceNumber: { type: Boolean, default: false },
    referenceLabel: { type: String, default: null },
    requiresFile: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    createdBy: { type: Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const DocumentRequirementModel = createScopedModel<DocumentRequirementDocument>(
  'DocumentRequirement',
  documentRequirementSchema
);
