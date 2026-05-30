import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import {
  PayrollBill,
  PayrollStatus,
} from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';

interface Actor {
  id: string;
  role: UserRole | null;
}

const REVIEW_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.ACCOUNTANT,
];

export interface ReviewInput {
  action: 'approve' | 'reject';
  reason?: string;
}

export class ReviewPayrollBillUseCase {
  constructor(
    private payrollRepo: IPayrollRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(actor: Actor, billId: string, input: ReviewInput): Promise<PayrollBill> {
    if (!actor.role || !REVIEW_ROLES.includes(actor.role)) {
      throw new AppError('Only dispatch managers can review payroll bills.', 403);
    }

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);
    if (bill.status !== PayrollStatus.SUBMITTED) {
      throw new AppError('Only submitted bills can be reviewed.', 409);
    }

    const reviewer = await this.userRepo.findById(actor.id);
    const reviewerName = reviewer?.fullName?.trim() || reviewer?.email || 'Dispatch';

    if (input.action === 'reject') {
      const reason = input.reason?.trim();
      if (!reason) throw new AppError('A reason is required to reject a bill.', 400);
      const updated = await this.payrollRepo.update(billId, {
        status: PayrollStatus.REJECTED,
        reviewedBy: actor.id,
        reviewedByName: reviewerName,
        reviewedAt: new Date(),
        rejectionReason: reason,
      });
      if (!updated) throw new AppError('Failed to reject payroll bill.', 500);
      return updated;
    }

    const updated = await this.payrollRepo.update(billId, {
      status: PayrollStatus.APPROVED,
      reviewedBy: actor.id,
      reviewedByName: reviewerName,
      reviewedAt: new Date(),
      rejectionReason: null,
    });
    if (!updated) throw new AppError('Failed to approve payroll bill.', 500);
    return updated;
  }
}
