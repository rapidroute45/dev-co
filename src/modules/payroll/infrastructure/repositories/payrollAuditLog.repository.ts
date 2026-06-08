import { PayrollAuditLogModel } from '../models/payrollAuditLog.model';

export type PayrollAuditLogRecord = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  metadata: unknown;
  createdAt: Date;
};

export class PayrollAuditLogRepository {
  async append(entry: {
    userId: string;
    userName: string;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: unknown;
  }): Promise<PayrollAuditLogRecord> {
    const doc = await PayrollAuditLogModel.create({
      userId: entry.userId,
      userName: entry.userName,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      metadata: entry.metadata ?? null,
    });
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      userName: doc.userName,
      action: doc.action,
      entityType: doc.entityType ?? null,
      entityId: doc.entityId ?? null,
      oldValue: doc.oldValue,
      newValue: doc.newValue,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
    };
  }

  async list(params?: {
    limit?: number;
    teamId?: string;
    action?: string;
  }): Promise<PayrollAuditLogRecord[]> {
    const query: Record<string, unknown> = {};
    if (params?.action) query.action = params.action;
    const docs = await PayrollAuditLogModel.find(query)
      .sort({ createdAt: -1 })
      .limit(params?.limit ?? 100);
    return docs.map((doc) => ({
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      userName: doc.userName,
      action: doc.action,
      entityType: doc.entityType ?? null,
      entityId: doc.entityId ?? null,
      oldValue: doc.oldValue,
      newValue: doc.newValue,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
    }));
  }
}
