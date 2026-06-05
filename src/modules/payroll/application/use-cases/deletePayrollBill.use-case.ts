import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

const DELETABLE_STATUSES = new Set<PayrollStatus>([
  PayrollStatus.DRAFT,
  PayrollStatus.TEAM_LEAD_DISPUTED,
]);

interface Actor {
  role: UserRole | null;
}

export class DeletePayrollBillUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(actor: Actor, billId: string): Promise<void> {
    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('Only admin or dispatch manager can delete payroll bills.', 403);
    }

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);
    if (!DELETABLE_STATUSES.has(bill.status)) {
      throw new AppError(
        'Only draft or disputed bills can be deleted. Paid and in-review bills cannot be removed.',
        409
      );
    }

    const deleted = await this.payrollRepo.deleteById(billId);
    if (!deleted) throw new AppError('Failed to delete payroll bill.', 500);
  }
}
