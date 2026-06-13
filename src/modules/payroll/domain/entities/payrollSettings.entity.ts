export type PayrollSettingsProps = {
  id?: string;
  smallRouteRate: number;
  mediumRouteRate: number;
  fullRouteRate: number;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export class PayrollSettings {
  constructor(private props: PayrollSettingsProps) {}

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
