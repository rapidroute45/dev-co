import { ScheduleStatus } from '../../../../shared/constants/scheduleStatuses';

export interface ScheduleProps {
  id?: string;
  date: Date;
  city: string;
  state: string;
  storeId: string;
  createdBy: string;
  status: ScheduleStatus;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Schedule {
  private props: ScheduleProps;

  constructor(props: ScheduleProps) {
    this.props = {
      ...props,
      notes: props.notes ?? null,
      status: props.status ?? ScheduleStatus.DRAFT,
    };
  }

  get id() {
    return this.props.id;
  }
  get date() {
    return this.props.date;
  }
  get city() {
    return this.props.city;
  }
  get state() {
    return this.props.state;
  }
  get storeId() {
    return this.props.storeId;
  }
  get createdBy() {
    return this.props.createdBy;
  }
  get status() {
    return this.props.status;
  }
  get notes() {
    return this.props.notes ?? null;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
