import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../../../config/env';
import { AuthenticatedUser } from '../../../shared/middleware/auth.middleware';
import { UserRole } from '../../../shared/constants/roles';
import { ChatService } from '../application/services/chat.service';
import { getActorAssignedCities, normalizeCity } from '../../../shared/services/cityScope.service';
import { trackingCityRoom } from '../../../shared/utils/trackingCityKey';
import { resolveDbEnvironment, withDbEnvironment } from '../../../config/dbContext';

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

function roomDispatchOpsTracking() {
  return 'tracking:dispatch-ops';
}

function roomTrackingCityName(city: string) {
  return `tracking:city:${normalizeCity(city)}`;
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
      socket.data.dbEnvironment = resolveDbEnvironment(
        (socket.handshake.auth?.dbEnvironment as string | undefined) ??
          (socket.handshake.headers['x-dispatch-environment'] as string | undefined)
      );
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as ChatSocketUser;
    const dbEnvironment = socket.data.dbEnvironment as ReturnType<typeof resolveDbEnvironment>;
    void socket.join(roomForUser(user.id));

    if (user.role && MANAGER_ROLES.includes(user.role)) {
      void socket.join(roomManagers());
      void socket.join(roomDispatchOpsTracking());
    }

    if (user.role === UserRole.DISPATCH_TEAM) {
      for (const city of getActorAssignedCities(user)) {
        void socket.join(roomTrackingCityName(city));
      }
    }

    void withDbEnvironment(dbEnvironment, () =>
      chatService.listConversationIdsForUser(user.id, user.role)
    ).then((ids) => {
      ids.forEach((id) => void socket.join(roomForConversation(id)));
    });

    void withDbEnvironment(dbEnvironment, () =>
      chatService.markConversationsDelivered(user.id, user.role)
    );

    socket.on('conversation:join', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      const ok = await withDbEnvironment(dbEnvironment, () =>
        chatService.userInConversation(user.id, user.role, conversationId)
      );
      if (ok) void socket.join(roomForConversation(conversationId));
    });

    socket.on('message:delivered', async (payload: { conversationId?: string }) => {
      await withDbEnvironment(dbEnvironment, () =>
        chatService.markConversationsDelivered(
          user.id,
          user.role,
          payload?.conversationId ? String(payload.conversationId) : undefined
        )
      );
    });

    socket.on('message:send', async (payload: { conversationId?: string; body?: string }) => {
      try {
        const message = await withDbEnvironment(dbEnvironment, async () =>
          chatService.sendMessage({
            conversationId: String(payload?.conversationId ?? ''),
            senderId: user.id,
            senderRole: user.role,
            body: String(payload?.body ?? '').trim(),
          })
        );
        emitNewChatMessage(message);
        socket.emit('message:new', message);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    socket.on('typing:start', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      const ok = await withDbEnvironment(dbEnvironment, () =>
        chatService.userInConversation(user.id, user.role, conversationId)
      );
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

export function emitMessagesRead(payload: {
  conversationId: string;
  readerId: string;
}) {
  if (!io) return;
  io.to(roomForConversation(payload.conversationId)).emit('messages:read', {
    conversationId: payload.conversationId,
    readerId: payload.readerId,
  });
}

export function emitMessagesDelivered(payload: {
  conversationId: string;
  userId: string;
}) {
  if (!io) return;
  io.to(roomForConversation(payload.conversationId)).emit('messages:delivered', {
    conversationId: payload.conversationId,
    userId: payload.userId,
  });
}

export function emitNewChatMessage(message: {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  type: string;
  meta?: Record<string, unknown>;
  createdAt: Date | string;
  recipientId?: string;
  participantIds?: string[];
  readBy?: string[];
  deliveredTo?: string[];
}) {
  if (!io) return;
  const payload = {
    ...message,
    createdAt: message.createdAt,
  };
  io.to(roomForConversation(message.conversationId)).emit('message:new', payload);

  // Notify every member's personal room so their conversation list updates,
  // even if they have not joined the conversation room yet (groups included).
  const notifyIds = new Set<string>([message.senderId]);
  if (message.participantIds?.length) {
    for (const id of message.participantIds) notifyIds.add(String(id));
  } else if (message.recipientId) {
    notifyIds.add(String(message.recipientId));
  }
  for (const id of notifyIds) {
    if (!id) continue;
    io.to(roomForUser(id)).emit('conversation:updated', {
      conversationId: message.conversationId,
    });
  }
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

export type RouteUpdatedAction = 'created' | 'updated' | 'deleted';

export function emitRouteUpdated(payload: {
  routeId: string;
  scheduleId: string;
  action: RouteUpdatedAction;
  driverIds?: Array<string | null | undefined>;
}) {
  if (!io) return;

  const event = {
    routeId: payload.routeId,
    scheduleId: payload.scheduleId,
    action: payload.action,
    updatedAt: new Date().toISOString(),
  };

  const driverIds = [...new Set(payload.driverIds?.filter(Boolean).map(String) ?? [])];
  for (const driverId of driverIds) {
    io.to(roomForUser(driverId)).emit('route:updated', event);
  }

  io.to(roomDispatchOpsTracking()).emit('route:updated', event);
}

export type DriverLocationUpdatedPayload = {
  routeId: string;
  scheduleId: string;
  driverId: string;
  driverName: string;
  routeName: string | null;
  lat: number;
  lng: number;
  recordedAt: string;
  ingestedAt?: string;
  status: string;
  city: string;
  state: string;
  storeName?: string | null;
  progress?: {
    totalDropoffs: number;
    completedDropoffs: number;
    returnedDropoffs: number;
    pendingDropoffs: number;
  };
  autoCompletedStops?: { stopId: string; stopName: string }[];
  routeCompleted?: boolean;
  dwell?: {
    active: boolean;
    minutes: number;
    alertSent: boolean;
    thresholdMinutes?: number;
    startedAt?: string | null;
  };
  backgroundSharing?: boolean;
  /** Full GPS segment from a batch upload so dispatch can draw the actual path. */
  trailPoints?: { lat: number; lng: number; recordedAt: string }[];
};

export function emitDriverLocationUpdated(payload: DriverLocationUpdatedPayload) {
  if (!io) return;

  io.to(roomDispatchOpsTracking()).emit('driver:location', payload);
  io.to(roomTrackingCityName(payload.city)).emit('driver:location', payload);
  io.to(trackingCityRoom(payload.city, payload.state)).emit('driver:location', payload);
}

export type DriverStationaryAlertPayload = {
  routeId: string;
  scheduleId: string;
  driverId: string;
  driverName: string;
  dwellMinutes: number;
  lat: number;
  lng: number;
  city: string;
  state: string;
  routeName: string | null;
};

export function emitDriverStationaryAlert(payload: DriverStationaryAlertPayload) {
  if (!io) return;

  io.to(roomDispatchOpsTracking()).emit('driver:stationary', payload);
  io.to(roomTrackingCityName(payload.city)).emit('driver:stationary', payload);
  io.to(trackingCityRoom(payload.city, payload.state)).emit('driver:stationary', payload);
}
