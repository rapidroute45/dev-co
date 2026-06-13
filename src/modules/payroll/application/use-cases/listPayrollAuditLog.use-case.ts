import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { PayrollAuditLogRepository } from '../../infrastructure/repositories/payrollAuditLog.repository';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

export class ListPayrollAuditLogUseCase {
  constructor(private auditRepo: PayrollAuditLogRepository) {}

  async execute(
    actor: { role: UserRole | null },
    query: { limit?: string; action?: string }
  ) {
    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('You do not have access to payroll audit log.', 403);
    }
    const limit = query.limit ? Math.min(500, Math.max(1, Number(query.limit))) : 100;
    const logs = await this.auditRepo.list({
      limit: Number.isFinite(limit) ? limit : 100,
      action: query.action?.trim(),
    });
    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.userName,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValue: log.oldValue,
      newValue: log.newValue,
      timestamp: log.createdAt.toISOString(),
    }));
  }
}
