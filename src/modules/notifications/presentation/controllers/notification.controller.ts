import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { ListNotificationsUseCase } from '../../application/use-cases/listNotifications.use-case';

export class NotificationController {
  constructor(private listNotificationsUseCase: ListNotificationsUseCase) {}

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.listNotificationsUseCase.execute(req.user.id);
      res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      next(error);
    }
  };
}
