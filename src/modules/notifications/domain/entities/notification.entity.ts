export enum NotificationType {
  ROUTE_ASSIGNED = 'route_assigned',
  ROUTE_NEEDS_DRIVER = 'route_needs_driver',
  ROUTE_OFFER = 'route_offer',
  DOCUMENT_REQUIRED = 'document_required',
  DOCUMENT_UPDATED = 'document_updated',
  DOCUMENT_VERIFIED = 'document_verified',
  DOCUMENT_REJECTED = 'document_rejected',
  PAYROLL_GENERATED = 'payroll_generated',
  PAYROLL_SENT = 'payroll_sent',
  PAYROLL_APPROVED = 'payroll_approved',
  ROUTE_OPS_REVIEW = 'route_ops_review',
  CHAT_MESSAGE = 'chat_message',
  SCHEDULE_CREATED = 'schedule_created',
  SCHEDULE_UPDATED = 'schedule_updated',
  ROUTE_CREATED = 'route_created',
  ROUTE_UPDATED = 'route_updated',
  DISPATCH_TEAM_UPDATED = 'dispatch_team_updated',
  DRIVER_DWELLING = 'driver_dwelling',
  DRIVER_BREAK_STARTED = 'driver_break_started',
  DRIVER_BREAK_MOVEMENT = 'driver_break_movement',
  DRIVER_BREAK_ENDED = 'driver_break_ended',
  STOP_AUTO_COMPLETED = 'stop_auto_completed',
  STOP_COMPLETED = 'stop_completed',
  DRIVER_OFF_ROUTE = 'driver_off_route',
  DRIVER_LOCATION_STALE = 'driver_location_stale',
}

export interface NotificationProps {
  id?: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  read: boolean;
  pushSent?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Notification {
  private props: NotificationProps;

  constructor(props: NotificationProps) {
    this.props = { ...props, read: props.read ?? false, pushSent: props.pushSent ?? false };
  }

  get id() {
    return this.props.id;
  }
  get recipientId() {
    return this.props.recipientId;
  }
  get type() {
    return this.props.type;
  }
  get title() {
    return this.props.title;
  }
  get message() {
    return this.props.message;
  }
  get payload() {
    return this.props.payload;
  }
  get read() {
    return this.props.read;
  }
  get pushSent() {
    return this.props.pushSent ?? false;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
