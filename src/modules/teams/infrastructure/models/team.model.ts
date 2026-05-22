import { Schema, model, Types } from 'mongoose';

const TeamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    teamLeadId: { type: Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const TeamModel = model('Team', TeamSchema);
