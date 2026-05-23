import { Types } from 'mongoose';
import { AppError } from '../../../../shared/errors/app-error';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import { ConversationModel } from '../../infrastructure/models/conversation.model';
import { MessageModel } from '../../infrastructure/models/message.model';
import { emitDeliveryPhotoAlert } from '../../socket/chat.socket';

const MANAGER_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];
const DRIVER_ROLES = [UserRole.DRIVER, UserRole.TEAM_DRIVER];

function isManager(role: UserRole | null | undefined) {
  return role != null && MANAGER_ROLES.includes(role);
}

function isDriver(role: UserRole | null | undefined) {
  return role != null && DRIVER_ROLES.includes(role);
}

export class ChatService {
  constructor(
    private userRepo: UserRepository,
    private routeRepo: IRouteRepository
  ) {}

  private async getUserMap(ids: string[]) {
    const unique = [...new Set(ids.map(String))];
    const users = await Promise.all(unique.map((id) => this.userRepo.findById(id)));
    const map = new Map<string, { email: string; fullName?: string | null }>();
    users.forEach((u, i) => {
      if (u) map.set(unique[i], { email: u.email, fullName: u.fullName });
    });
    return map;
  }

  async listConversationIdsForUser(userId: string, role: UserRole | null) {
    const filter = isManager(role)
      ? { managerId: userId }
      : isDriver(role)
        ? { driverId: userId }
        : { _id: null };
    const rows = await ConversationModel.find(filter).select('_id').lean();
    return rows.map((r) => String(r._id));
  }

  async userInConversation(
    userId: string,
    role: UserRole | null,
    conversationId: string
  ) {
    const conv = await ConversationModel.findById(conversationId).lean();
    if (!conv) return false;
    const mid = String(conv.managerId);
    const did = String(conv.driverId);
    const uid = String(userId);
    if (isManager(role)) return mid === uid;
    if (isDriver(role)) return did === uid;
    return false;
  }

  async getOrCreateConversation(managerId: string, driverId: string) {
    let conv = await ConversationModel.findOne({ managerId, driverId });
    if (!conv) {
      conv = await ConversationModel.create({ managerId, driverId });
    }
    return conv;
  }

  async listConversations(userId: string, role: UserRole | null) {
    const filter = isManager(role)
      ? { managerId: userId }
      : isDriver(role)
        ? { driverId: userId }
        : null;
    if (!filter) throw new AppError('Chat not available for this role.', 403);

    const rows = await ConversationModel.find(filter)
      .sort({ lastMessageAt: -1 })
      .lean();

    const otherIds = rows.map((c) =>
      String(isManager(role) ? c.driverId : c.managerId)
    );
    const userMap = await this.getUserMap(otherIds);

    return rows.map((c) => {
      const otherId = String(isManager(role) ? c.driverId : c.managerId);
      const other = userMap.get(otherId);
      return {
        id: String(c._id),
        managerId: String(c.managerId),
        driverId: String(c.driverId),
        otherUserId: otherId,
        otherName: other?.fullName?.trim() || other?.email || 'User',
        otherEmail: other?.email ?? '',
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview ?? '',
        lastSenderId: c.lastSenderId ? String(c.lastSenderId) : null,
      };
    });
  }

  async listDriversForManager() {
    const drivers = await this.userRepo.findActiveDrivers();
    return drivers.map((d) => ({
      id: d.id!,
      email: d.email,
      fullName: d.fullName ?? null,
      role: d.role,
    }));
  }

  async openConversationForDriver(driverId: string) {
    const existing = await ConversationModel.findOne({ driverId }).sort({ lastMessageAt: -1 });
    if (existing) {
      const list = await this.listConversations(driverId, UserRole.DRIVER);
      return list.find((c) => c.id === String(existing._id)) ?? null;
    }

    const managers = await this.userRepo.findMany({
      role: UserRole.DISPATCH_MANAGER,
      status: UserStatus.ACTIVE,
    });
    const adminManagers = await this.userRepo.findMany({
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    const manager = [...managers, ...adminManagers][0];
    if (!manager?.id) {
      throw new AppError('No dispatch manager available for chat.', 503);
    }

    await this.getOrCreateConversation(manager.id, driverId);
    const list = await this.listConversations(driverId, UserRole.DRIVER);
    return list[0] ?? null;
  }

  async listMessages(
    userId: string,
    role: UserRole | null,
    conversationId: string,
    limit = 80
  ) {
    const ok = await this.userInConversation(userId, role, conversationId);
    if (!ok) throw new AppError('Conversation not found.', 404);

    const rows = await MessageModel.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    await MessageModel.updateMany(
      { conversationId, readBy: { $ne: new Types.ObjectId(userId) } },
      { $addToSet: { readBy: new Types.ObjectId(userId) } }
    );

    return rows.reverse().map((m) => ({
      id: String(m._id),
      conversationId: String(m.conversationId),
      senderId: String(m.senderId),
      body: m.body,
      type: m.type,
      meta: m.meta ?? {},
      createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
    }));
  }

  async sendMessage(params: {
    conversationId: string;
    senderId: string;
    senderRole: UserRole | null;
    body: string;
  }) {
    if (!params.body) throw new AppError('Message cannot be empty.', 400);

    const conv = await ConversationModel.findById(params.conversationId);
    if (!conv) throw new AppError('Conversation not found.', 404);

    const allowed = await this.userInConversation(
      params.senderId,
      params.senderRole,
      params.conversationId
    );
    if (!allowed) throw new AppError('Access denied.', 403);

    const msg = await MessageModel.create({
      conversationId: conv._id,
      senderId: params.senderId,
      body: params.body,
      type: 'text',
      readBy: [params.senderId],
    });

    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = params.body.slice(0, 120);
    conv.lastSenderId = new Types.ObjectId(params.senderId);
    await conv.save();

    const recipientId = isManager(params.senderRole)
      ? String(conv.driverId)
      : String(conv.managerId);

    return {
      id: String(msg._id),
      conversationId: String(conv._id),
      senderId: params.senderId,
      body: msg.body,
      type: msg.type,
      meta: {},
      createdAt: msg.createdAt?.toISOString?.() ?? msg.createdAt,
      recipientId,
    };
  }

  async notifyDeliveryPhoto(params: {
    routeId: string;
    driverId: string;
    stopId: string;
    stopName: string;
    photoUrl: string;
  }) {
    const route = await this.routeRepo.findById(params.routeId);
    if (!route) return;

    const managerId = String(route.assignedBy);
    const conv = await this.getOrCreateConversation(managerId, params.driverId);

    const body = `Delivery photo uploaded for stop: ${params.stopName}`;
    const msg = await MessageModel.create({
      conversationId: conv._id,
      senderId: params.driverId,
      body,
      type: 'delivery_photo',
      meta: {
        routeId: params.routeId,
        stopId: params.stopId,
        photoUrl: params.photoUrl,
        stopName: params.stopName,
      },
      readBy: [params.driverId],
    });

    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = body;
    conv.lastSenderId = new Types.ObjectId(params.driverId);
    await conv.save();

    const payload = {
      id: String(msg._id),
      conversationId: String(conv._id),
      senderId: params.driverId,
      body: msg.body,
      type: msg.type,
      meta: msg.meta,
      createdAt: msg.createdAt,
    };

    emitDeliveryPhotoAlert({
      conversationId: String(conv._id),
      managerId,
      driverId: params.driverId,
      message: payload,
    });
  }
}
