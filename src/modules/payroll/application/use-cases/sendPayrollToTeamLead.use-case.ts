import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { PayrollBill, PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

interface Actor {
  role: UserRole | null;
}

export class SendPayrollToTeamLeadUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(actor: Actor, billId: string): Promise<PayrollBill> {
    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('Only admin or dispatch manager can send payroll to team lead.', 403);
    }

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);

    if (bill.status !== PayrollStatus.DRAFT && bill.status !== PayrollStatus.TEAM_LEAD_DISPUTED) {
      throw new AppError('Only draft or disputed bills can be sent to the team lead.', 409);
    }
    if (bill.lineItems.length === 0) {
      throw new AppError('Cannot send an empty payroll bill.', 400);
    }

    const updated = await this.payrollRepo.update(billId, {
      status: PayrollStatus.PENDING_TEAM_LEAD,
      sentToTeamLeadAt: new Date(),
      teamLeadNote: bill.status === PayrollStatus.TEAM_LEAD_DISPUTED ? null : bill.teamLeadNote,
    });
    if (!updated) throw new AppError('Failed to send payroll bill.', 500);
    return updated;
  }
}
