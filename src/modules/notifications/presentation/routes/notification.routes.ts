import { Router } from 'express';
import { requireAuth } from '../../../../shared/middleware/auth.middleware';
import { ListNotificationsUseCase } from '../../application/use-cases/listNotifications.use-case';
import { RegisterDeviceTokenUseCase } from '../../application/use-cases/registerDeviceToken.use-case';
import { UnregisterDeviceTokenUseCase } from '../../application/use-cases/unregisterDeviceToken.use-case';
import { DeviceTokenRepository } from '../../infrastructure/repositories/deviceToken.repository';
import { NotificationRepository } from '../../infrastructure/repositories/notification.repository';
import { PushMessagingService } from '../../infrastructure/push/pushMessaging.service';
import { BroadcastTestPushUseCase } from '../../application/use-cases/broadcastTestPush.use-case';
import { MarkNotificationReadUseCase } from '../../application/use-cases/markNotificationRead.use-case';
import { NotificationController } from '../controllers/notification.controller';

const router = Router();
const notificationRepo = new NotificationRepository();
const deviceTokenRepo = new DeviceTokenRepository();
const pushService = new PushMessagingService(deviceTokenRepo);

const controller = new NotificationController(
  new ListNotificationsUseCase(notificationRepo),
  new RegisterDeviceTokenUseCase(deviceTokenRepo),
  new UnregisterDeviceTokenUseCase(deviceTokenRepo),
  new BroadcastTestPushUseCase(pushService),
  new MarkNotificationReadUseCase(notificationRepo)
);

router.get('/', requireAuth(), controller.listMine);
router.patch('/:id/read', requireAuth(), controller.markRead);
router.post('/device-tokens', requireAuth(), controller.registerDeviceToken);
router.delete('/device-tokens', requireAuth(), controller.unregisterDeviceToken);
router.post('/test-broadcast', requireAuth(), controller.broadcastTestPush);

export default router;
