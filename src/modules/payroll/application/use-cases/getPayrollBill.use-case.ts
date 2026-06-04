import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { PayrollBill } from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';

interface Actor {
  role: UserRole | null;
  teamId?: string | null;
}

const OPS_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.ACCOUNTANT,
];

export class GetPayrollBillUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(actor: Actor, billId: string): Promise<PayrollBill> {
    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);

    if (actor.role === UserRole.TEAM_LEAD) {
      if (!actor.teamId || bill.teamId !== actor.teamId) {
        throw new AppError('You can only view your own team payroll.', 403);
      }
      return bill;
    }

    if (actor.role && OPS_ROLES.includes(actor.role)) {
      return bill;
    }

    throw new AppError('You do not have access to payroll.', 403);
  }
}
