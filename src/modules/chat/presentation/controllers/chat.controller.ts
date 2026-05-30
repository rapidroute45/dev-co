import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { publicUploadPath } from '../../../../shared/upload/upload.config';
import { ChatService } from '../../application/services/chat.service';

const MANAGER_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

export class ChatController {
  constructor(
    private chatService: ChatService,
    private emitMessage?: (
      message: Awaited<ReturnType<ChatService['sendMessage']>>
    ) => void
  ) {}

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

  sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const { body } = req.body as { body?: string };
      const data = await this.chatService.sendMessage({
        conversationId: String(req.params.id),
        senderId: req.user.id,
        senderRole: req.user.role,
        body: String(body ?? '').trim(),
      });
      this.emitMessage?.(data);
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  sendVoiceMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      if (!req.file) return next(new AppError('Audio file is required.', 400));

      const durationRaw = (req.body as { durationMs?: string })?.durationMs;
      const durationMs = Number(durationRaw);

      const data = await this.chatService.sendVoiceMessage({
        conversationId: String(req.params.id),
        senderId: req.user.id,
        senderRole: req.user.role,
        audioUrl: publicUploadPath(req.file.filename),
        durationMs: Number.isFinite(durationMs) ? durationMs : 0,
      });
      this.emitMessage?.(data);
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };
}
