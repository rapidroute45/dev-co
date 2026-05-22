import { Router } from 'express';
import { requireAuth } from '../../../../shared/middleware/auth.middleware';
import { NotificationRepository } from '../../infrastructure/repositories/notification.repository';
import { ListNotificationsUseCase } from '../../application/use-cases/listNotifications.use-case';
import { NotificationController } from '../controllers/notification.controller';

const router = Router();
const notificationRepo = new NotificationRepository();

const controller = new NotificationController(
  new ListNotificationsUseCase(notificationRepo)
);

router.get('/', requireAuth(), controller.listMine);

export default router;
