import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { PayrollBill, PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { PayrollAuditService } from '../services/payrollAudit.service';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { formatScheduleDate } from '../../../schedules/application/utils/scheduleDate';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

interface Actor {
  id: string;
  role: UserRole | null;
}

export class SendPayrollToTeamLeadUseCase {
  constructor(
    private payrollRepo: IPayrollRepository,
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository,
    private audit: PayrollAuditService,
    private notifications: NotificationService
  ) {}

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

    const team = await this.teamRepo.findById(bill.teamId);
    const actorUser = await this.userRepo.findById(actor.id);
    await this.audit.log({
      userId: actor.id,
      userName: actorUser?.fullName?.trim() || actorUser?.email || 'User',
      action: 'payroll_sent_to_team_lead',
      entityType: 'PayrollBill',
      entityId: billId,
      oldValue: { status: bill.status },
      newValue: { status: PayrollStatus.PENDING_TEAM_LEAD },
    });

    const recipientIds: string[] = [];
    if (team?.teamLeadId) recipientIds.push(team.teamLeadId);
    if (recipientIds.length > 0) {
      await this.notifications.notifyPayrollSent({
        recipientIds,
        teamId: bill.teamId,
        teamName: bill.teamName,
        billId,
        totalAmount: bill.totalAmount,
        periodStart: formatScheduleDate(bill.periodStart),
        periodEnd: formatScheduleDate(bill.periodEnd),
      });
    }

    return updated;
  }
}
