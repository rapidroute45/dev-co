import { Schema, model, Types } from 'mongoose';
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
  assignedCity: { type: String, trim: true, default: null, index: true },
}, { timestamps: true });

UserSchema.index(
  { role: 1, assignedCity: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: UserRole.DISPATCH_TEAM,
      status: UserStatus.ACTIVE,
      assignedCity: { $type: 'string' },
    },
  }
);

export const UserModel = model('User', UserSchema);
