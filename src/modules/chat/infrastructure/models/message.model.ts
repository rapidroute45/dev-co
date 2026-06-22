import { Schema, Types } from 'mongoose';
import { createScopedModel } from '../../../../shared/db/createScopedModel';

const MessageSchema = new Schema(
  {
    conversationId: { type: Types.ObjectId, ref: 'ChatConversation', required: true, index: true },
    senderId: { type: Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'system', 'delivery_photo', 'voice', 'document'],
      default: 'text',
    },
    meta: {
      routeId: { type: String, default: null },
      stopId: { type: String, default: null },
      photoUrl: { type: String, default: null },
      stopName: { type: String, default: null },
      audioUrl: { type: String, default: null },
      durationMs: { type: Number, default: null },
      fileUrl: { type: String, default: null },
      fileName: { type: String, default: null },
      fileSize: { type: Number, default: null },
      mimeType: { type: String, default: null },
    },
    deliveredTo: [{ type: Types.ObjectId, ref: 'User' }],
    readBy: [{ type: Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const MessageModel = createScopedModel('ChatMessage', MessageSchema);
