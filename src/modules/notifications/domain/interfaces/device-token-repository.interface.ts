import { DevicePlatform, DeviceToken } from '../entities/deviceToken.entity';

export interface IDeviceTokenRepository {
  upsert(input: {
    userId: string;
    token: string;
    platform: DevicePlatform;
    deviceId?: string | null;
  }): Promise<DeviceToken>;
  removeForUser(userId: string, token?: string): Promise<number>;
  removeByTokenValue(token: string): Promise<void>;
  findByUserIds(userIds: string[], platform: DevicePlatform): Promise<DeviceToken[]>;
  findAllByPlatform(platform: DevicePlatform): Promise<DeviceToken[]>;
}
