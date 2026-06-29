export type DevicePlatform = 'ios' | 'android' | 'web';

/** Push delivery and registration (Android mobile + web ops app). */
export const SUPPORTED_PUSH_PLATFORMS: DevicePlatform[] = ['android', 'web'];

export interface DeviceTokenProps {
  id?: string;
  userId: string;
  token: string;
  platform: DevicePlatform;
  deviceId?: string | null;
  lastSeenAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DeviceToken {
  private props: DeviceTokenProps;

  constructor(props: DeviceTokenProps) {
    this.props = props;
  }

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get token() {
    return this.props.token;
  }
  get platform() {
    return this.props.platform;
  }
  get deviceId() {
    return this.props.deviceId ?? null;
  }
  get lastSeenAt() {
    return this.props.lastSeenAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
