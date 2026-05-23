import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { ChatService } from '../../application/services/chat.service';

const MANAGER_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

export class ChatController {
  constructor(private chatService: ChatService) {}

  listConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.chatService.listConversations(req.user.id, req.user.role);
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  listDrivers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.role || !MANAGER_ROLES.includes(req.user.role)) {
        return next(new AppError('Managers only.', 403));
      }
      const data = await this.chatService.listDriversForManager();
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  createConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      if (!req.user.role || !MANAGER_ROLES.includes(req.user.role)) {
        return next(new AppError('Managers only.', 403));
      }
      const { driverId } = req.body as { driverId?: string };
      if (!driverId) return next(new AppError('driverId is required.', 400));
      await this.chatService.getOrCreateConversation(req.user.id, driverId);
      const list = await this.chatService.listConversations(req.user.id, req.user.role);
      const conv = list.find((c) => c.driverId === driverId);
      res.status(201).json({ success: true, data: conv ?? null });
    } catch (e) {
      next(e);
    }
  };

  openConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const DRIVER_ROLES = [UserRole.DRIVER, UserRole.TEAM_DRIVER];
      if (!req.user.role || !DRIVER_ROLES.includes(req.user.role)) {
        return next(new AppError('Drivers only.', 403));
      }
      const data = await this.chatService.openConversationForDriver(req.user.id);
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  listMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.chatService.listMessages(
        req.user.id,
        req.user.role,
        String(req.params.id)
      );
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };
}
