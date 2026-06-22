import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { publicUploadPath } from '../../../../shared/upload/upload.config';
import { ChatService } from '../../application/services/chat.service';

const OPS_CHAT_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.DISPATCH_TEAM,
];
const DRIVER_ROLES = [UserRole.DRIVER, UserRole.TEAM_DRIVER];
const GROUP_CREATOR_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.DISPATCH_TEAM,
  UserRole.TEAM_LEAD,
  UserRole.TEAM_DRIVER,
];

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
      if (!req.user?.role || !OPS_CHAT_ROLES.includes(req.user.role)) {
        return next(new AppError('Ops roles only.', 403));
      }
      const data = await this.chatService.listDriversForOps(
        req.user.role,
        req.user.assignedCity
      );
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  listOpsPeers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.chatService.listOpsPeers(req.user.id, req.user.role);
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  createConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      if (!req.user.role || !OPS_CHAT_ROLES.includes(req.user.role)) {
        return next(new AppError('Ops roles only.', 403));
      }
      const { driverId } = req.body as { driverId?: string };
      if (!driverId) return next(new AppError('driverId is required.', 400));
      await this.chatService.getOrCreateConversation(req.user.id, driverId);
      const list = await this.chatService.listConversations(req.user.id, req.user.role);
      const conv = list.find((c) => c.driverId === driverId && c.kind === 'driver');
      res.status(201).json({ success: true, data: conv ?? null });
    } catch (e) {
      next(e);
    }
  };

  createInternalConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      if (!req.user.role || !OPS_CHAT_ROLES.includes(req.user.role)) {
        return next(new AppError('Ops roles only.', 403));
      }
      const { peerId } = req.body as { peerId?: string };
      if (!peerId) return next(new AppError('peerId is required.', 400));
      await this.chatService.getOrCreateInternalConversation(req.user.id, peerId);
      const list = await this.chatService.listConversations(req.user.id, req.user.role);
      const conv = list.find(
        (c) => c.kind === 'internal' && (c.otherUserId === peerId)
      );
      res.status(201).json({ success: true, data: conv ?? null });
    } catch (e) {
      next(e);
    }
  };

  openConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
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

  sendDocumentMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      if (!req.file) return next(new AppError('File is required.', 400));

      const data = await this.chatService.sendDocumentMessage({
        conversationId: String(req.params.id),
        senderId: req.user.id,
        senderRole: req.user.role,
        fileUrl: publicUploadPath(req.file.filename),
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });
      this.emitMessage?.(data);
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  listGroupCandidates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      if (!req.user.role || !GROUP_CREATOR_ROLES.includes(req.user.role)) {
        return next(new AppError('You cannot create groups.', 403));
      }
      const data = await this.chatService.listGroupCandidates(req.user.id, req.user.role);
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  createGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      if (!req.user.role || !GROUP_CREATOR_ROLES.includes(req.user.role)) {
        return next(new AppError('You cannot create groups.', 403));
      }
      const { title, memberIds } = req.body as { title?: string; memberIds?: string[] };
      const data = await this.chatService.createGroup({
        creatorId: req.user.id,
        creatorRole: req.user.role,
        title: String(title ?? ''),
        memberIds: Array.isArray(memberIds) ? memberIds.map(String) : [],
      });
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  updateGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const { title, addMemberIds, removeMemberIds } = req.body as {
        title?: string;
        addMemberIds?: string[];
        removeMemberIds?: string[];
      };
      const data = await this.chatService.updateGroup({
        conversationId: String(req.params.id),
        actorId: req.user.id,
        actorRole: req.user.role,
        title,
        addMemberIds: Array.isArray(addMemberIds) ? addMemberIds.map(String) : undefined,
        removeMemberIds: Array.isArray(removeMemberIds)
          ? removeMemberIds.map(String)
          : undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  leaveGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.chatService.leaveGroup({
        conversationId: String(req.params.id),
        actorId: req.user.id,
      });
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };
}
