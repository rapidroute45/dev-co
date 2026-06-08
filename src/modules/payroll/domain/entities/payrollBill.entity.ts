import { RouteCategory } from '../../../../shared/constants/routeCategories';

export enum PayrollStatus {
  /** Ops generated from completed routes; not sent to team lead yet. */
  DRAFT = 'draft',
  /** Sent to team lead for review. */
  PENDING_TEAM_LEAD = 'pending_team_lead',
  /** Team lead approved the bill. */
  TEAM_LEAD_APPROVED = 'team_lead_approved',
  /** Team lead flagged an issue (see teamLeadNote). */
  TEAM_LEAD_DISPUTED = 'team_lead_disputed',
  /** Ops marked paid and uploaded receipt. */
  PAID = 'paid',
}

/** @deprecated Legacy statuses — normalized when reading from DB. */
export const LEGACY_PAYROLL_STATUS_MAP: Record<string, PayrollStatus> = {
  submitted: PayrollStatus.PENDING_TEAM_LEAD,
  approved: PayrollStatus.TEAM_LEAD_APPROVED,
  rejected: PayrollStatus.TEAM_LEAD_DISPUTED,
};

export function normalizePayrollStatus(status: string): PayrollStatus {
  return (
    LEGACY_PAYROLL_STATUS_MAP[status] ??
    (Object.values(PayrollStatus).includes(status as PayrollStatus)
      ? (status as PayrollStatus)
      : PayrollStatus.DRAFT)
  );
}

/** A single completed route credited to a driver on a bill. */
export interface PayrollRouteLine {
  routeId: string;
  routeName: string | null;
  location: string | null;
  scheduleDate: Date;
  completedAt: Date | null;
  /** Final pay for this route (after adjustment). */
  rate: number;
  routeCategory: RouteCategory;
  defaultRate: number;
  originalAmount: number;
  hasAdjustment?: boolean;
  adjustmentReason?: string | null;
}

/** Per-driver roll-up: base pay from routes + optional bonus/deduction. */
export interface PayrollDriverLine {
  driverId: string;
  driverName: string;
  routeCount: number;
  basePay: number;
  bonus: number;
  deduction: number;
  overtime: number;
  total: number;
  routes: PayrollRouteLine[];
}

export interface PayrollBillProps {
  id?: string;
  teamId: string;
  teamName: string;
  teamNumber: number;
  periodStart: Date;
  periodEnd: Date;
  status: PayrollStatus;
  standardRate: number;
  lineItems: PayrollDriverLine[];
  totalAmount: number;
  subtotal?: number;
  adjustmentsTotal?: number;
  bonusesTotal?: number;
  deductionsTotal?: number;
  overtimeTotal?: number;
  /** Ops internal note. */
  note?: string | null;
  teamLeadAcknowledgedAt?: Date | null;
  createdBy: string;
  createdByName: string;
  sentToTeamLeadAt?: Date | null;
  teamLeadNote?: string | null;
  teamLeadReviewedAt?: Date | null;
  paymentReceiptUrl?: string | null;
  paidAt?: Date | null;
  paidBy?: string | null;
  paidByName?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PayrollBill {
  constructor(private props: PayrollBillProps) {}

  get id() {
    return this.props.id;
  }
  get teamId() {
    return this.props.teamId;
  }
  get teamName() {
    return this.props.teamName;
  }
  get teamNumber() {
    return this.props.teamNumber;
  }
  get periodStart() {
    return this.props.periodStart;
  }
  get periodEnd() {
    return this.props.periodEnd;
  }
  get status() {
    return this.props.status;
  }
  get standardRate() {
    return this.props.standardRate;
  }
  get lineItems() {
    return this.props.lineItems;
  }
  get totalAmount() {
    return this.props.totalAmount;
  }
  get subtotal() {
    return this.props.subtotal ?? this.props.totalAmount;
  }
  get adjustmentsTotal() {
    return this.props.adjustmentsTotal ?? 0;
  }
  get bonusesTotal() {
    return this.props.bonusesTotal ?? 0;
  }
  get deductionsTotal() {
    return this.props.deductionsTotal ?? 0;
  }
  get overtimeTotal() {
    return this.props.overtimeTotal ?? 0;
  }
  get teamLeadAcknowledgedAt() {
    return this.props.teamLeadAcknowledgedAt ?? null;
  }
  get note() {
    return this.props.note ?? null;
  }
  get createdBy() {
    return this.props.createdBy;
  }
  get createdByName() {
    return this.props.createdByName;
  }
  get sentToTeamLeadAt() {
    return this.props.sentToTeamLeadAt ?? null;
  }
  get teamLeadNote() {
    return this.props.teamLeadNote ?? null;
  }
  get teamLeadReviewedAt() {
    return this.props.teamLeadReviewedAt ?? null;
  }
  get paymentReceiptUrl() {
    return this.props.paymentReceiptUrl ?? null;
  }
  get paidAt() {
    return this.props.paidAt ?? null;
  }
  get paidBy() {
    return this.props.paidBy ?? null;
  }
  get paidByName() {
    return this.props.paidByName ?? null;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
