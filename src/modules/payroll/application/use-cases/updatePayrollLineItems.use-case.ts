import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import {
  PayrollBill,
  PayrollStatus,
} from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';

interface Actor {
  role: UserRole | null;
}

export interface LineAdjustment {
  driverId: string;
  bonus?: number;
  deduction?: number;
  overtime?: number;
}

export interface UpdateLineItemsInput {
  adjustments: LineAdjustment[];
  note?: string;
}

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

function sanitize(value: number | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.round(num * 100) / 100;
}

export class UpdatePayrollLineItemsUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(
    actor: Actor,
    billId: string,
    input: UpdateLineItemsInput
  ): Promise<PayrollBill> {
    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('Only admin or dispatch manager can edit payroll.', 403);
    }

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);
    if (bill.status !== PayrollStatus.DRAFT && bill.status !== PayrollStatus.TEAM_LEAD_DISPUTED) {
      throw new AppError('Payroll can only be edited while draft or after team lead dispute.', 409);
    }

    const adjByDriver = new Map<string, LineAdjustment>();
    input.adjustments.forEach((a) => adjByDriver.set(a.driverId, a));

    const lineItems = bill.lineItems.map((line) => {
      const adj = adjByDriver.get(line.driverId);
      const bonus = sanitize(adj?.bonus, line.bonus);
      const deduction = sanitize(adj?.deduction, line.deduction);
      const overtime = sanitize(adj?.overtime, line.overtime ?? 0);
      return {
        ...line,
        bonus,
        deduction,
        overtime,
        total: line.basePay + bonus + overtime - deduction,
      };
    });
    const totalAmount = lineItems.reduce((sum, line) => sum + line.total, 0);

    const updated = await this.payrollRepo.update(billId, {
      lineItems,
      totalAmount,
      note: input.note,
    });
    if (!updated) throw new AppError('Failed to update payroll bill.', 500);
    return updated;
  }
}
