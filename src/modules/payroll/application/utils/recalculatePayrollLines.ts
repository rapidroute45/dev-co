import type {
  PayrollDriverLine,
  PayrollRouteLine,
} from '../../domain/entities/payrollBill.entity';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function recalculateDriverLine(
  line: PayrollDriverLine,
  standardRate: number
): PayrollDriverLine {
  const routes: PayrollRouteLine[] = line.routes.map((r) => ({
    ...r,
    rate: standardRate,
  }));
  const routeCount = routes.length;
  const basePay = roundMoney(routeCount * standardRate);
  const bonus = line.bonus;
  const deduction = line.deduction;
  const overtime = line.overtime ?? 0;
  return {
    ...line,
    routes,
    routeCount,
    basePay,
    total: roundMoney(basePay + bonus + overtime - deduction),
  };
}

export function totalFromLineItems(lineItems: PayrollDriverLine[]): number {
  return roundMoney(lineItems.reduce((sum, line) => sum + line.total, 0));
}
