import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

const TeamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    /** Auto-incrementing display number (1000, 2000, 3000, ...). */
    teamNumber: { type: Number, required: true, unique: true, sparse: true },
    teamLeadId: { type: Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const TeamModel = createScopedModel('Team', TeamSchema);
