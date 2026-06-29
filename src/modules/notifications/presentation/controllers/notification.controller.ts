import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { ListNotificationsUseCase } from '../../application/use-cases/listNotifications.use-case';
import { RegisterDeviceTokenUseCase } from '../../application/use-cases/registerDeviceToken.use-case';
import { UnregisterDeviceTokenUseCase } from '../../application/use-cases/unregisterDeviceToken.use-case';
import { BroadcastTestPushUseCase } from '../../application/use-cases/broadcastTestPush.use-case';
import { MarkNotificationReadUseCase } from '../../application/use-cases/markNotificationRead.use-case';

export class NotificationController {
  constructor(
    private listNotificationsUseCase: ListNotificationsUseCase,
    private registerDeviceTokenUseCase: RegisterDeviceTokenUseCase,
    private unregisterDeviceTokenUseCase: UnregisterDeviceTokenUseCase,
    private broadcastTestPushUseCase: BroadcastTestPushUseCase,
    private markNotificationReadUseCase: MarkNotificationReadUseCase
  ) {}

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.listNotificationsUseCase.execute(req.user.id);
      console.log('[notifications-list]', {
        recipientId: req.user.id,
        role: req.user.role,
        count: data.length,
      });
      res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      next(error);
    }
  };

  registerDeviceToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));

      const data = await this.registerDeviceTokenUseCase.execute({
        userId: req.user.id,
        token: String(req.body?.token ?? ''),
        platform: String(req.body?.platform ?? ''),
        deviceId: req.body?.deviceId != null ? String(req.body.deviceId) : null,
      });

      res.status(200).json({
        success: true,
        message: 'Device token registered.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  unregisterDeviceToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));

      const token =
        req.body?.token != null
          ? String(req.body.token)
          : req.query.token != null
            ? String(req.query.token)
            : undefined;

      const data = await this.unregisterDeviceTokenUseCase.execute({
        userId: req.user.id,
        token,
      });

      res.status(200).json({
        success: true,
        message: token ? 'Device token removed.' : 'All device tokens removed.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /** Dev-only: send dummy push to all registered Android device tokens. */
  broadcastTestPush = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));

      const data = await this.broadcastTestPushUseCase.execute({
        requesterRole: req.user.role,
        title: req.body?.title != null ? String(req.body.title) : undefined,
        body: req.body?.body != null ? String(req.body.body) : undefined,
        deepLink: req.body?.deepLink != null ? String(req.body.deepLink) : undefined,
      });

      res.status(200).json({
        success: true,
        message: 'Test push broadcast sent.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));

      const data = await this.markNotificationReadUseCase.execute(
        req.user.id,
        String(req.params.id)
      );

      res.status(200).json({
        success: true,
        message: 'Notification marked as read.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
