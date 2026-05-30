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
  status?: PayrollStatus;
  note?: string | null;
  submittedAt?: Date | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
}

export interface IPayrollRepository {
  findById(id: string): Promise<PayrollBill | null>;
  findByTeamAndPeriod(
    teamId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<PayrollBill | null>;
  findMany(filters: PayrollListFilters): Promise<PayrollBill[]>;
  save(bill: PayrollBill): Promise<PayrollBill>;
  update(id: string, data: PayrollBillUpdateData): Promise<PayrollBill | null>;
}
