import {
  PayrollBill,
  PayrollDriverLine,
  PayrollStatus,
} from '../entities/payrollBill.entity';

export interface PayrollListFilters {
  teamId?: string;
  status?: PayrollStatus;
}

export interface PayrollBillUpdateData {
  lineItems?: PayrollDriverLine[];
  totalAmount?: number;
  subtotal?: number;
  adjustmentsTotal?: number;
  bonusesTotal?: number;
  deductionsTotal?: number;
  overtimeTotal?: number;
  standardRate?: number;
  status?: PayrollStatus;
  note?: string | null;
  teamLeadAcknowledgedAt?: Date | null;
  sentToTeamLeadAt?: Date | null;
  teamLeadNote?: string | null;
  teamLeadReviewedAt?: Date | null;
  paymentReceiptUrl?: string | null;
  paidAt?: Date | null;
  paidBy?: string | null;
  paidByName?: string | null;
}

export interface IPayrollRepository {
  findById(id: string): Promise<PayrollBill | null>;
  findByTeamAndPeriod(
    teamId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<PayrollBill | null>;
  findOpenBillByTeam(teamId: string): Promise<PayrollBill | null>;
  findBillContainingRoute(routeId: string): Promise<PayrollBill | null>;
  collectAllBilledRouteIds(): Promise<string[]>;
  findMany(filters: PayrollListFilters): Promise<PayrollBill[]>;
  save(bill: PayrollBill): Promise<PayrollBill>;
  update(id: string, data: PayrollBillUpdateData): Promise<PayrollBill | null>;
  deleteById(id: string): Promise<boolean>;
}
