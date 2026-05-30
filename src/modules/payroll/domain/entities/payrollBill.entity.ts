export enum PayrollStatus {
  /** Team lead is still editing bonuses/deductions. */
  DRAFT = 'draft',
  /** Team lead sent it to dispatch for approval. */
  SUBMITTED = 'submitted',
  /** Dispatch manager / admin approved the bill. */
  APPROVED = 'approved',
  /** Dispatch manager / admin sent it back for changes. */
  REJECTED = 'rejected',
}

/** A single completed route credited to a driver on a bill. */
export interface PayrollRouteLine {
  routeId: string;
  routeName: string | null;
  location: string | null;
  scheduleDate: Date;
  completedAt: Date | null;
  rate: number;
}

/** Per-driver roll-up: base pay from routes + manual bonus/deduction. */
export interface PayrollDriverLine {
  driverId: string;
  driverName: string;
  routeCount: number;
  basePay: number;
  bonus: number;
  deduction: number;
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
  note?: string | null;
  createdBy: string;
  createdByName: string;
  submittedAt?: Date | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
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
  get note() {
    return this.props.note ?? null;
  }
  get createdBy() {
    return this.props.createdBy;
  }
  get createdByName() {
    return this.props.createdByName;
  }
  get submittedAt() {
    return this.props.submittedAt ?? null;
  }
  get reviewedBy() {
    return this.props.reviewedBy ?? null;
  }
  get reviewedByName() {
    return this.props.reviewedByName ?? null;
  }
  get reviewedAt() {
    return this.props.reviewedAt ?? null;
  }
  get rejectionReason() {
    return this.props.rejectionReason ?? null;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
