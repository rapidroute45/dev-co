import { PayrollStatus } from '../../domain/entities/payrollBill.entity';

/** Bills in workflow — routes on these bills are not counted as pending. */
export const OPEN_PAYROLL_STATUSES: PayrollStatus[] = [
  PayrollStatus.DRAFT,
  PayrollStatus.PENDING_TEAM_LEAD,
  PayrollStatus.TEAM_LEAD_APPROVED,
  PayrollStatus.TEAM_LEAD_DISPUTED,
];
