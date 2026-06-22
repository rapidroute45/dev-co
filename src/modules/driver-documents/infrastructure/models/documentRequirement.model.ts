import mongoose from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

const documentRequirementSchema = new mongoose.Schema(
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const DocumentRequirementModel = createScopedModel(
  'DocumentRequirement',
  documentRequirementSchema
);
