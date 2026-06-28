import { AppError } from '../../../../shared/errors/app-error';
import {
  DevicePlatform,
  SUPPORTED_PUSH_PLATFORMS,
} from '../../domain/entities/deviceToken.entity';
import { IDeviceTokenRepository } from '../../domain/interfaces/device-token-repository.interface';

export class RegisterDeviceTokenUseCase {
  constructor(private deviceTokenRepo: IDeviceTokenRepository) {}

  async execute(input: {
    userId: string;
    token: string;
    platform: string;
    deviceId?: string | null;
  }) {
    const platform = input.platform.trim().toLowerCase() as DevicePlatform;
    if (!SUPPORTED_PUSH_PLATFORMS.includes(platform)) {
      throw new AppError(
        `Only ${SUPPORTED_PUSH_PLATFORMS.join(', ')} push tokens are supported.`,
        400
      );
    }

    const token = input.token.trim();
    if (!token || token.length < 20) {
      throw new AppError('Invalid FCM device token.', 400);
    }

    const saved = await this.deviceTokenRepo.upsert({
      userId: input.userId,
      token,
      platform,
      deviceId: input.deviceId?.trim() || null,
    });

    return {
      id: saved.id,
      platform: saved.platform,
      deviceId: saved.deviceId,
      lastSeenAt: saved.lastSeenAt,
    };
  }
}
