import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

export type ConversationKind = 'driver' | 'internal' | 'group';

export interface ConversationDocument {
  _id: Types.ObjectId;
  managerId?: Types.ObjectId | null;
  driverId?: Types.ObjectId | null;
  kind?: ConversationKind;
  participants: Types.ObjectId[];
  title?: string | null;
  createdBy?: Types.ObjectId | null;
  admins: Types.ObjectId[];
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  lastSenderId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ConversationSchema = new Schema(
  {
    /** driver ↔ ops, or ops ↔ ops when kind is internal. Null for group chats. */
    managerId: {
      type: Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    driverId: {
      type: Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    kind: {
      type: String,
      enum: ['driver', 'internal', 'group'],
      default: 'driver',
      index: true,
    },
    /** Canonical membership. Always populated; primary source of truth for groups. */
    participants: {
      type: [{ type: Types.ObjectId, ref: 'User' }],
      default: [],
      index: true,
    },
    /** Group-only metadata. */
    title: { type: String, trim: true, default: null },
    createdBy: { type: Types.ObjectId, ref: 'User', default: null },
    admins: { type: [{ type: Types.ObjectId, ref: 'User' }], default: [] },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, default: '' },
    lastSenderId: { type: Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Pairwise uniqueness only applies to 1:1 conversations (driver/internal).
ConversationSchema.index(
  { managerId: 1, driverId: 1 },
  {
    unique: true,
    partialFilterExpression: { kind: { $in: ['driver', 'internal'] } },
  }
);

export const ConversationModel = createScopedModel<ConversationDocument>(
  'ChatConversation',
  ConversationSchema
);
