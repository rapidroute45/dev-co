import type { PayrollDriverLine } from '../../domain/entities/payrollBill.entity';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type DriverLineAdjustmentInput = {
  driverId: string;
  bonus?: number;
  deduction?: number;
  overtime?: number;
};

function sanitizeMoney(value: number | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return roundMoney(num);
}

export function applyDriverAdjustments(
  lineItems: PayrollDriverLine[],
  adjustments: DriverLineAdjustmentInput[] = []
): PayrollDriverLine[] {
  const adjByDriver = new Map<string, DriverLineAdjustmentInput>();
  adjustments.forEach((a) => adjByDriver.set(a.driverId, a));

  return lineItems.map((line) => {
    const adj = adjByDriver.get(line.driverId);
    const bonus = sanitizeMoney(adj?.bonus, line.bonus);
    const deduction = sanitizeMoney(adj?.deduction, line.deduction);
    const overtime = sanitizeMoney(adj?.overtime, line.overtime ?? 0);
    const total = roundMoney(line.basePay + bonus + overtime - deduction);
    return { ...line, bonus, deduction, overtime, total };
  });
}

export function driverAdjustmentsRollup(lineItems: PayrollDriverLine[]): {
  bonusesTotal: number;
  deductionsTotal: number;
  overtimeTotal: number;
} {
  let bonusesTotal = 0;
  let deductionsTotal = 0;
  let overtimeTotal = 0;
  for (const line of lineItems) {
    bonusesTotal += line.bonus ?? 0;
    deductionsTotal += line.deduction ?? 0;
    overtimeTotal += line.overtime ?? 0;
  }
  return {
    bonusesTotal: roundMoney(bonusesTotal),
    deductionsTotal: roundMoney(deductionsTotal),
    overtimeTotal: roundMoney(overtimeTotal),
  };
}
