import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { PayrollBill, PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { PayrollAuditService } from '../services/payrollAudit.service';
import { NotificationService } from '../../../notifications/application/services/notification.service';

interface TeamLeadActor {
  id: string;
  role: UserRole | null;
  teamId?: string | null;
}

interface TeamLeadReviewActor {
  role: UserRole | null;
  teamId?: string | null;
}

export class TeamLeadApprovePayrollUseCase {
  constructor(
    private payrollRepo: IPayrollRepository,
    private userRepo: IUserRepository,
    private audit: PayrollAuditService,
    private notifications: NotificationService
  ) {}

  async execute(actor: TeamLeadActor, billId: string): Promise<PayrollBill> {
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

    const actorUser = await this.userRepo.findById(actor.id);
    await this.audit.log({
      userId: actor.id,
      userName: actorUser?.fullName?.trim() || actorUser?.email || 'Team Lead',
      action: 'payroll_approved',
      entityType: 'PayrollBill',
      entityId: billId,
      oldValue: { status: bill.status },
      newValue: { status: PayrollStatus.TEAM_LEAD_APPROVED },
    });

    const opsUsers = await this.userRepo.findActiveByRoles([
      UserRole.ADMIN,
      UserRole.DISPATCH_MANAGER,
    ]);
    await this.notifications.notifyPayrollApproved({
      recipientIds: opsUsers.map((u) => u.id!).filter(Boolean),
      teamId: bill.teamId,
      teamName: bill.teamName,
      billId,
      totalAmount: bill.totalAmount,
    });

    return updated;
  }
}

export class TeamLeadDisputePayrollUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(actor: TeamLeadReviewActor, billId: string, note: string): Promise<PayrollBill> {
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
