import mongoose from 'mongoose';
import { AppError } from '../../../../shared/errors/app-error';
import { DevicePlatform, DeviceToken } from '../../domain/entities/deviceToken.entity';
import { IDeviceTokenRepository } from '../../domain/interfaces/device-token-repository.interface';
import {
  DeviceTokenDocument,
  DeviceTokenModel,
} from '../models/deviceToken.model';

function toUserObjectId(userId: string): mongoose.Types.ObjectId | null {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  return new mongoose.Types.ObjectId(userId);
}

function mapDoc(doc: DeviceTokenDocument): DeviceToken {
  return new DeviceToken({
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    token: doc.token,
    platform: doc.platform,
    deviceId: doc.deviceId ?? null,
    lastSeenAt: doc.lastSeenAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class DeviceTokenRepository implements IDeviceTokenRepository {
  async upsert(input: {
    userId: string;
    token: string;
    platform: DevicePlatform;
    deviceId?: string | null;
  }): Promise<DeviceToken> {
    const userOid = toUserObjectId(input.userId) ?? input.userId;
    const now = new Date();

    const doc = await DeviceTokenModel.findOneAndUpdate(
      { token: input.token },
      {
        $set: {
          userId: userOid,
          token: input.token,
          platform: input.platform,
          deviceId: input.deviceId ?? null,
          lastSeenAt: now,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    if (!doc) {
      throw new AppError('Failed to save device token.', 500);
    }

    return mapDoc(doc);
  }

  async removeForUser(userId: string, token?: string): Promise<number> {
    const userOid = toUserObjectId(userId);
    const filter: Record<string, unknown> = userOid
      ? { userId: userOid }
      : { userId };
    if (token) filter.token = token;

    const result = await DeviceTokenModel.deleteMany(filter);
    return result.deletedCount ?? 0;
  }

  async removeByTokenValue(token: string): Promise<void> {
    await DeviceTokenModel.deleteOne({ token });
  }

  async findByUserIds(userIds: string[], platform: DevicePlatform): Promise<DeviceToken[]> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return [];

    const userFilters = ids.flatMap((userId) => {
      const oid = toUserObjectId(userId);
      if (!oid) return [{ userId }];
      return [{ userId: oid }, { userId }];
    });

    const docs = await DeviceTokenModel.find({
      $or: userFilters,
      platform,
    });

    return docs.map((doc) => mapDoc(doc));
  }

  async findAllByPlatform(platform: DevicePlatform): Promise<DeviceToken[]> {
    const docs = await DeviceTokenModel.find({ platform });
    return docs.map((doc) => mapDoc(doc));
  }
}
