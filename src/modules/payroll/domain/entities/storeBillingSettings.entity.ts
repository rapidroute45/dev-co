export interface StoreBillingSettingsProps {
  id?: string;
  /** Rates the warehouse charges stores per route category. */
  smallRouteRate: number;
  mediumRouteRate: number;
  fullRouteRate: number;
  overtimeHourlyRate: number;
  weeklyPerformanceIncentive: number;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class StoreBillingSettings {
  constructor(private props: StoreBillingSettingsProps) {}

  get id() {
    return this.props.id;
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
    return this.props.overtimeHourlyRate;
  }
  get weeklyPerformanceIncentive() {
    return this.props.weeklyPerformanceIncentive;
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
