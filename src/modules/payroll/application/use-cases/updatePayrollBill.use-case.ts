import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import {
  PayrollBill,
  PayrollStatus,
} from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import {
  recalculateDriverLine,
  totalFromLineItems,
} from '../utils/recalculatePayrollLines';
import {
  applyDriverAdjustments,
  driverAdjustmentsRollup,
} from '../utils/payrollBillRollups';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

interface Actor {
  role: UserRole | null;
}

export interface LineAdjustment {
  driverId: string;
  bonus?: number;
  deduction?: number;
  overtime?: number;
}

export interface UpdatePayrollBillInput {
  adjustments?: LineAdjustment[];
  note?: string | null;
  standardRate?: number;
  removeRouteIds?: string[];
}

const EDITABLE_STATUSES = new Set<PayrollStatus>([
  PayrollStatus.DRAFT,
  PayrollStatus.TEAM_LEAD_DISPUTED,
  PayrollStatus.PENDING_TEAM_LEAD,
]);

export class UpdatePayrollBillUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(
    actor: Actor,
    billId: string,
    input: UpdatePayrollBillInput
  ): Promise<PayrollBill> {
    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('Only admin or dispatch manager can edit payroll.', 403);
    }

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);
    if (!EDITABLE_STATUSES.has(bill.status)) {
      throw new AppError(
        'Payroll can only be edited while draft, with team lead, or after team lead dispute.',
        409
      );
    }

    const removeSet = new Set(
      (input.removeRouteIds ?? []).map((id) => id.trim()).filter(Boolean)
    );

    let standardRate = bill.standardRate;
    if (input.standardRate !== undefined) {
      const rate = Number(input.standardRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new AppError('standardRate must be a positive number.', 400);
      }
      standardRate = Math.round(rate * 100) / 100;
    }

    let lineItems = bill.lineItems
      .map((line) => ({
        ...line,
        routes: line.routes.filter((r) => !removeSet.has(r.routeId)),
      }))
      .filter((line) => line.routes.length > 0)
      .map((line) => recalculateDriverLine(line, standardRate));

    if (lineItems.length === 0) {
      throw new AppError(
        'Bill must include at least one route. Delete the bill instead of removing all routes.',
        400
      );
    }

    lineItems = applyDriverAdjustments(lineItems, input.adjustments ?? []);
    const totalAmount = totalFromLineItems(lineItems);
    const rollups = driverAdjustmentsRollup(lineItems);

    const updated = await this.payrollRepo.update(billId, {
      lineItems,
      totalAmount,
      standardRate,
      bonusesTotal: rollups.bonusesTotal,
      deductionsTotal: rollups.deductionsTotal,
      overtimeTotal: rollups.overtimeTotal,
      note: input.note !== undefined ? input.note : bill.note,
      ...(bill.status === PayrollStatus.TEAM_LEAD_DISPUTED
        ? { teamLeadNote: null, teamLeadReviewedAt: null }
        : bill.status === PayrollStatus.PENDING_TEAM_LEAD
          ? { teamLeadAcknowledgedAt: null, teamLeadReviewedAt: null }
          : {}),
    });
    if (!updated) throw new AppError('Failed to update payroll bill.', 500);
    return updated;
  }
}
