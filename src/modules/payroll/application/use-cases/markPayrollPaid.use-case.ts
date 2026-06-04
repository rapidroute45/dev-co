import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { PayrollBill, PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

interface Actor {
  id: string;
  role: UserRole | null;
}

export class MarkPayrollPaidUseCase {
  constructor(
    private payrollRepo: IPayrollRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(
    actor: Actor,
    billId: string,
    paymentReceiptUrl: string
  ): Promise<PayrollBill> {
    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('Only admin or dispatch manager can mark payroll as paid.', 403);
    }

    const receipt = paymentReceiptUrl?.trim();
    if (!receipt) throw new AppError('Payment receipt is required.', 400);

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);
    if (bill.status !== PayrollStatus.TEAM_LEAD_APPROVED) {
      throw new AppError('Bill must be approved by the team lead before payment.', 409);
    }

    const payer = await this.userRepo.findById(actor.id);
    const payerName = payer?.fullName?.trim() || payer?.email || 'Dispatch';

    const updated = await this.payrollRepo.update(billId, {
      status: PayrollStatus.PAID,
      paymentReceiptUrl: receipt,
      paidAt: new Date(),
      paidBy: actor.id,
      paidByName: payerName,
    });
    if (!updated) throw new AppError('Failed to mark bill as paid.', 500);
    return updated;
  }
}
