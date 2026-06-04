import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { PayrollBill, PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';

interface Actor {
  role: UserRole | null;
  teamId?: string | null;
}

export class TeamLeadApprovePayrollUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(actor: Actor, billId: string): Promise<PayrollBill> {
    if (actor.role !== UserRole.TEAM_LEAD) {
      throw new AppError('Only team leads can approve payroll bills.', 403);
    }

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);
    if (!actor.teamId || bill.teamId !== actor.teamId) {
      throw new AppError('You can only review your own team payroll.', 403);
    }
    if (bill.status !== PayrollStatus.PENDING_TEAM_LEAD) {
      throw new AppError('This bill is not waiting for your approval.', 409);
    }

    const updated = await this.payrollRepo.update(billId, {
      status: PayrollStatus.TEAM_LEAD_APPROVED,
      teamLeadReviewedAt: new Date(),
      teamLeadNote: null,
    });
    if (!updated) throw new AppError('Failed to approve payroll bill.', 500);
    return updated;
  }
}

export class TeamLeadDisputePayrollUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(actor: Actor, billId: string, note: string): Promise<PayrollBill> {
    if (actor.role !== UserRole.TEAM_LEAD) {
      throw new AppError('Only team leads can dispute payroll bills.', 403);
    }

    const trimmed = note?.trim();
    if (!trimmed) throw new AppError('Please describe the issue with this bill.', 400);

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);
    if (!actor.teamId || bill.teamId !== actor.teamId) {
      throw new AppError('You can only review your own team payroll.', 403);
    }
    if (bill.status !== PayrollStatus.PENDING_TEAM_LEAD) {
      throw new AppError('This bill is not waiting for your review.', 409);
    }

    const updated = await this.payrollRepo.update(billId, {
      status: PayrollStatus.TEAM_LEAD_DISPUTED,
      teamLeadReviewedAt: new Date(),
      teamLeadNote: trimmed,
    });
    if (!updated) throw new AppError('Failed to save your note.', 500);
    return updated;
  }
}
