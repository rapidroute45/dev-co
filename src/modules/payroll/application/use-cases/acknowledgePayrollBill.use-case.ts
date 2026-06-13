import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import { PayrollAuditService } from '../services/payrollAudit.service';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';

export class AcknowledgePayrollBillUseCase {
  constructor(
    private payrollRepo: IPayrollRepository,
    private audit: PayrollAuditService,
    private userRepo: IUserRepository
  ) {}

  async execute(actor: { id: string; role: UserRole | null; teamId?: string | null }, billId: string) {
    if (actor.role !== UserRole.TEAM_LEAD) {
      throw new AppError('Only team leads can acknowledge payroll.', 403);
    }

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);
    if (bill.teamId !== actor.teamId) {
      throw new AppError('This payroll bill is not for your team.', 403);
    }
    if (bill.status !== PayrollStatus.PENDING_TEAM_LEAD) {
      throw new AppError('Payroll must be sent to team lead before acknowledgement.', 400);
    }
    if (bill.teamLeadAcknowledgedAt) {
      throw new AppError('Payroll already acknowledged.', 400);
    }

    const updated = await this.payrollRepo.update(billId, {
      teamLeadAcknowledgedAt: new Date(),
    });
    if (!updated) throw new AppError('Failed to acknowledge payroll.', 500);

    const user = await this.userRepo.findById(actor.id);
    await this.audit.log({
      userId: actor.id,
      userName: user?.fullName?.trim() || user?.email || 'Team Lead',
      action: 'payroll_acknowledged',
      entityType: 'PayrollBill',
      entityId: billId,
      newValue: { teamLeadAcknowledgedAt: updated.teamLeadAcknowledgedAt?.toISOString() },
    });

    return updated;
  }
}
