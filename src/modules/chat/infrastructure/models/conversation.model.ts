import { Schema, model, Types } from 'mongoose';

const ConversationSchema = new Schema(
  {
    /** driver ↔ ops, or ops ↔ ops when kind is internal */
    managerId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    driverId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    kind: {
      type: String,
      enum: ['driver', 'internal'],
      default: 'driver',
      index: true,
    },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, default: '' },
    lastSenderId: { type: Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

ConversationSchema.index({ managerId: 1, driverId: 1 }, { unique: true });

export const ConversationModel = model('ChatConversation', ConversationSchema);
