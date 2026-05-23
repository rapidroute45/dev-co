import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../../../config/env';
import { AuthenticatedUser } from '../../../shared/middleware/auth.middleware';
import { UserRole } from '../../../shared/constants/roles';
import { ChatService } from '../application/services/chat.service';

export type ChatSocketUser = AuthenticatedUser;

let io: Server | null = null;

const MANAGER_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

export function getIo(): Server | null {
  return io;
}

function roomForConversation(conversationId: string) {
  return `conversation:${conversationId}`;
}

function roomForUser(userId: string) {
  return `user:${userId}`;
}

function roomManagers() {
  return 'role:managers';
}

export function initChatSocket(httpServer: HttpServer, chatService: ChatService) {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');

    if (!token) return next(new Error('Unauthorized'));

    try {
      const user = jwt.verify(token, ENV.JWT_SECRET) as ChatSocketUser;
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as ChatSocketUser;
    void socket.join(roomForUser(user.id));

    if (user.role && MANAGER_ROLES.includes(user.role)) {
      void socket.join(roomManagers());
    }

    void chatService.listConversationIdsForUser(user.id, user.role).then((ids) => {
      ids.forEach((id) => void socket.join(roomForConversation(id)));
    });

    socket.on('conversation:join', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      const ok = await chatService.userInConversation(user.id, user.role, conversationId);
      if (ok) void socket.join(roomForConversation(conversationId));
    });

    socket.on('message:send', async (payload: { conversationId?: string; body?: string }) => {
      try {
        const message = await chatService.sendMessage({
          conversationId: String(payload?.conversationId ?? ''),
          senderId: user.id,
          senderRole: user.role,
          body: String(payload?.body ?? '').trim(),
        });
        io?.to(roomForConversation(message.conversationId)).emit('message:new', message);
        io?.to(roomForUser(message.recipientId)).emit('conversation:updated', {
          conversationId: message.conversationId,
        });
        io?.to(roomForUser(user.id)).emit('conversation:updated', {
          conversationId: message.conversationId,
        });
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    socket.on('typing:start', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      const ok = await chatService.userInConversation(user.id, user.role, conversationId);
      if (!ok) return;
      socket.to(roomForConversation(conversationId)).emit('typing:update', {
        conversationId,
        userId: user.id,
        isTyping: true,
      });
    });

    socket.on('typing:stop', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      socket.to(roomForConversation(conversationId)).emit('typing:update', {
        conversationId,
        userId: user.id,
        isTyping: false,
      });
    });
  });

  return io;
}

export function emitDeliveryPhotoAlert(payload: {
  conversationId: string;
  managerId: string;
  driverId: string;
  message: Record<string, unknown>;
}) {
  if (!io) return;
  io.to(roomForConversation(payload.conversationId)).emit('message:new', payload.message);
  io.to(roomForUser(payload.managerId)).emit('conversation:updated', {
    conversationId: payload.conversationId,
  });
  io.to(roomForUser(payload.driverId)).emit('conversation:updated', {
    conversationId: payload.conversationId,
  });
  io.to(roomManagers()).emit('delivery:photo', {
    conversationId: payload.conversationId,
    message: payload.message,
  });
}
