import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import {
  PayrollBill,
  PayrollStatus,
} from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';

interface Actor {
  role: UserRole | null;
  teamId?: string | null;
}

export class SubmitPayrollBillUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(actor: Actor, billId: string): Promise<PayrollBill> {
    if (actor.role !== UserRole.TEAM_LEAD) {
      throw new AppError('Only team leads can submit payroll bills.', 403);
    }

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);
    if (!actor.teamId || bill.teamId !== actor.teamId) {
      throw new AppError('You can only submit your own team payroll.', 403);
    }
    if (bill.status !== PayrollStatus.DRAFT && bill.status !== PayrollStatus.REJECTED) {
      throw new AppError('This bill has already been submitted.', 409);
    }
    if (bill.lineItems.length === 0) {
      throw new AppError('Cannot submit an empty payroll bill.', 400);
    }

    const updated = await this.payrollRepo.update(billId, {
      status: PayrollStatus.SUBMITTED,
      submittedAt: new Date(),
      rejectionReason: null,
    });
    if (!updated) throw new AppError('Failed to submit payroll bill.', 500);
    return updated;
  }
}
