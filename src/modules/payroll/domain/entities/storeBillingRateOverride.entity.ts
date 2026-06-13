export interface StoreBillingRateOverrideProps {
  id?: string;
  storeId: string;
  smallRouteRate: number;
  mediumRouteRate: number;
  fullRouteRate: number;
  overtimeHourlyRate?: number | null;
  weeklyPerformanceIncentive?: number | null;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class StoreBillingRateOverride {
  constructor(private props: StoreBillingRateOverrideProps) {}

  get id() {
    return this.props.id;
  }
  get storeId() {
    return this.props.storeId;
  }
  get smallRouteRate() {
    return this.props.smallRouteRate;
  }
  get mediumRouteRate() {
    return this.props.mediumRouteRate;
  }
  get fullRouteRate() {
    return this.props.fullRouteRate;
  }
  get overtimeHourlyRate() {
    return this.props.overtimeHourlyRate ?? null;
  }
  get weeklyPerformanceIncentive() {
    return this.props.weeklyPerformanceIncentive ?? null;
  }
  get updatedBy() {
    return this.props.updatedBy ?? null;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
