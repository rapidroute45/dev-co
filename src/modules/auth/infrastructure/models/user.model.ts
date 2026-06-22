import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  fullName: { type: String, trim: true, default: null },
  phone: { type: String, trim: true, default: null },
  role: {
    type: String,
    enum: [...Object.values(UserRole), null],
    default: null,
    required: false,
  },
  status: { type: String, enum: Object.values(UserStatus), default: UserStatus.PENDING },
  teamId: { type: Types.ObjectId, ref: 'Team', default: null },
  /** Legacy single city — team leads; migrated dispatch team reads fall back here. */
  assignedCity: { type: String, trim: true, default: null, index: true },
  /** Dispatch team may operate in multiple cities. */
  assignedCities: { type: [String], default: [], index: true },
}, { timestamps: true });

export const UserModel = createScopedModel('User', UserSchema);
