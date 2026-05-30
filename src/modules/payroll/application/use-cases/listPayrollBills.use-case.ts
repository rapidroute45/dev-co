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

const DISPATCH_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.ACCOUNTANT,
];

export class ListPayrollBillsUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(
    actor: Actor,
    filters: { status?: PayrollStatus; teamId?: string }
  ): Promise<PayrollBill[]> {
    if (actor.role === UserRole.TEAM_LEAD) {
      if (!actor.teamId) return [];
      return this.payrollRepo.findMany({
        teamId: actor.teamId,
        status: filters.status,
      });
    }

    if (actor.role && DISPATCH_ROLES.includes(actor.role)) {
      return this.payrollRepo.findMany({
        teamId: filters.teamId,
        status: filters.status,
      });
    }

    throw new AppError('You do not have access to payroll.', 403);
  }
}
