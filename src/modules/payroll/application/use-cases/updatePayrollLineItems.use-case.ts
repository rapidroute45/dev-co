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
}

export interface UpdateLineItemsInput {
  adjustments: LineAdjustment[];
  note?: string;
}

const DISPATCH_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.ACCOUNTANT,
];

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
    if (!actor.role || !DISPATCH_ROLES.includes(actor.role)) {
      throw new AppError('Only dispatch staff can set bonus and deductions.', 403);
    }

    const bill = await this.payrollRepo.findById(billId);
    if (!bill) throw new AppError('Payroll bill not found.', 404);
    if (bill.status !== PayrollStatus.SUBMITTED) {
      throw new AppError('Bonus and deductions can only be edited on submitted bills.', 409);
    }

    const adjByDriver = new Map<string, LineAdjustment>();
    input.adjustments.forEach((a) => adjByDriver.set(a.driverId, a));

    const lineItems = bill.lineItems.map((line) => {
      const adj = adjByDriver.get(line.driverId);
      const bonus = sanitize(adj?.bonus, line.bonus);
      const deduction = sanitize(adj?.deduction, line.deduction);
      return {
        ...line,
        bonus,
        deduction,
        total: line.basePay + bonus - deduction,
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
