import { Schema, model, Types } from 'mongoose';

const PayrollAuditLogSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, default: '' },
    action: { type: String, required: true, index: true },
    entityType: { type: String, default: null },
    entityId: { type: String, default: null, index: true },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PayrollAuditLogSchema.index({ createdAt: -1 });

export const PayrollAuditLogModel = model('PayrollAuditLog', PayrollAuditLogSchema);
