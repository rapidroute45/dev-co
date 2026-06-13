import { PayrollAuditLogRepository } from '../../infrastructure/repositories/payrollAuditLog.repository';

export class PayrollAuditService {
  constructor(private auditRepo: PayrollAuditLogRepository) {}

  async log(params: {
    userId: string;
    userName: string;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: unknown;
  }): Promise<void> {
    await this.auditRepo.append(params);
  }
}
