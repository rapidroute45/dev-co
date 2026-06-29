import { AppError } from '../../../../shared/errors/app-error';
import { ENV } from '../../../../config/env';
import { UserRole } from '../../../../shared/constants/roles';
import { NotificationType } from '../../domain/entities/notification.entity';
import { PushMessagingService } from '../../infrastructure/push/pushMessaging.service';

export type BroadcastTestPushInput = {
  requesterRole: UserRole | null;
  title?: string;
  body?: string;
  deepLink?: string;
};

export class BroadcastTestPushUseCase {
  constructor(private pushService: PushMessagingService) {}

  async execute(input: BroadcastTestPushInput) {
    if (ENV.APP_ENV !== 'development') {
      throw new AppError('Test push broadcast is only available in development.', 403);
    }

    if (input.requesterRole !== UserRole.ADMIN) {
      throw new AppError('Only admins can send test push broadcasts.', 403);
    }

    const title = input.title?.trim() || 'Dispatch test notification';
    const body =
      input.body?.trim() ||
      'This is a dummy push sent to all registered Android devices.';
    const deepLink = input.deepLink?.trim() || '/notifications';

    const result = await this.pushService.sendBroadcast({
      title,
      body,
      type: NotificationType.ROUTE_OFFER,
      payload: {
        deepLink,
        testBroadcast: true,
      },
    });

    return {
      ...result,
      title,
      body,
      deepLink,
    };
  }
}
