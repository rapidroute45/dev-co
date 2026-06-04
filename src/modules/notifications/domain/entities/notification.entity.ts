export enum NotificationType {
  ROUTE_ASSIGNED = 'route_assigned',
  ROUTE_OFFER = 'route_offer',
  DOCUMENT_REQUIRED = 'document_required',
  DOCUMENT_UPDATED = 'document_updated',
  DOCUMENT_VERIFIED = 'document_verified',
  DOCUMENT_REJECTED = 'document_rejected',
  DRIVER_DWELLING = 'driver_dwelling',
  STOP_AUTO_COMPLETED = 'stop_auto_completed',
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
