import { Schema, model, Types } from 'mongoose';

const MessageSchema = new Schema(
  {
    conversationId: { type: Types.ObjectId, ref: 'ChatConversation', required: true, index: true },
    senderId: { type: Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'system', 'delivery_photo', 'voice'],
      default: 'text',
    },
    meta: {
      routeId: { type: String, default: null },
      stopId: { type: String, default: null },
      photoUrl: { type: String, default: null },
      stopName: { type: String, default: null },
      audioUrl: { type: String, default: null },
      durationMs: { type: Number, default: null },
    },
    deliveredTo: [{ type: Types.ObjectId, ref: 'User' }],
    readBy: [{ type: Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const MessageModel = model('ChatMessage', MessageSchema);
