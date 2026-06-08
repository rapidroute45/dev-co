import { Types } from 'mongoose';
import { AppError } from '../../../../shared/errors/app-error';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../../schedules/domain/interfaces/schedule-repository.interface';
import { ConversationModel } from '../../infrastructure/models/conversation.model';
import { MessageModel } from '../../infrastructure/models/message.model';
import {
  emitDeliveryPhotoAlert,
  emitMessagesDelivered,
  emitMessagesRead,
} from '../../socket/chat.socket';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';

const OPS_CHAT_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.DISPATCH_TEAM,
];
const DRIVER_ROLES = [UserRole.DRIVER, UserRole.TEAM_DRIVER];

function isOps(role: UserRole | null | undefined) {
  return role != null && OPS_CHAT_ROLES.includes(role);
}

function isDriver(role: UserRole | null | undefined) {
  return role != null && DRIVER_ROLES.includes(role);
}

export class ChatService {
  constructor(
    private userRepo: UserRepository,
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository
  ) {}

  private async getUserMap(ids: string[]) {
    const unique = [...new Set(ids.map(String))];
    const users = await Promise.all(unique.map((id) => this.userRepo.findById(id)));
    const map = new Map<string, { email: string; fullName?: string | null; role?: UserRole | null }>();
    users.forEach((u, i) => {
      if (u) map.set(unique[i], { email: u.email, fullName: u.fullName, role: u.role });
    });
    return map;
  }

  private conversationFilter(userId: string, role: UserRole | null): Record<string, unknown> {
    if (isOps(role)) {
      return {
        $or: [
          { managerId: userId },
          { driverId: userId, kind: 'internal' as const },
        ],
      };
    }
    if (isDriver(role)) {
      return {
        driverId: userId,
        $or: [{ kind: 'driver' as const }, { kind: { $exists: false } }],
      };
    }
    return { _id: null };
  }

  async listConversationIdsForUser(userId: string, role: UserRole | null) {
    const filter = this.conversationFilter(userId, role);
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
    if (conv.kind === 'internal') {
      return isOps(role) && (mid === uid || did === uid);
    }
    if (isOps(role)) return mid === uid;
    if (isDriver(role)) return did === uid;
    return false;
  }

  async getOrCreateConversation(opsUserId: string, driverId: string) {
    let conv = await ConversationModel.findOne({
      managerId: opsUserId,
      driverId,
      kind: 'driver',
    });
    if (!conv) {
      conv = await ConversationModel.create({
        managerId: opsUserId,
        driverId,
        kind: 'driver',
      });
    }
    return conv;
  }

  async getOrCreateInternalConversation(opsUserA: string, opsUserB: string) {
    const pair = [String(opsUserA), String(opsUserB)].sort();
    let conv = await ConversationModel.findOne({
      kind: 'internal',
      managerId: pair[0],
      driverId: pair[1],
    });
    if (!conv) {
      conv = await ConversationModel.create({
        managerId: pair[0],
        driverId: pair[1],
        kind: 'internal',
      });
    }
    return conv;
  }

  async listConversations(userId: string, role: UserRole | null) {
    const filter = this.conversationFilter(userId, role);
    if ('_id' in filter && filter._id === null) {
      throw new AppError('Chat not available for this role.', 403);
    }

    const rows = await ConversationModel.find(filter)
      .sort({ lastMessageAt: -1 })
      .lean();

    const otherIds = rows.map((c) => {
      const mid = String(c.managerId);
      const did = String(c.driverId);
      const uid = String(userId);
      if (c.kind === 'internal') return mid === uid ? did : mid;
      return isOps(role) ? did : mid;
    });
    const userMap = await this.getUserMap(otherIds);

    return rows.map((c) => {
      const mid = String(c.managerId);
      const did = String(c.driverId);
      const uid = String(userId);
      const otherId =
        c.kind === 'internal' ? (mid === uid ? did : mid) : isOps(role) ? did : mid;
      const other = userMap.get(otherId);
      return {
        id: String(c._id),
        managerId: mid,
        driverId: did,
        kind: c.kind ?? 'driver',
        otherUserId: otherId,
        otherName: other?.fullName?.trim() || other?.email || 'User',
        otherEmail: other?.email ?? '',
        otherRole: other?.role ?? null,
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview ?? '',
        lastSenderId: c.lastSenderId ? String(c.lastSenderId) : null,
      };
    });
  }

  async listDriversForOps(actorRole: UserRole | null, assignedCity?: string | null) {
    if (!isOps(actorRole)) throw new AppError('Ops roles only.', 403);
    const drivers = await this.userRepo.findActiveDrivers();
    return drivers.map((d) => ({
      id: d.id!,
      email: d.email,
      fullName: d.fullName ?? null,
      role: d.role,
    }));
  }

  async listOpsPeers(userId: string, role: UserRole | null) {
    if (!isOps(role)) throw new AppError('Ops roles only.', 403);

    if (role === UserRole.DISPATCH_TEAM) {
      const managers = await this.userRepo.findActiveByRoles([
        UserRole.DISPATCH_MANAGER,
        UserRole.ADMIN,
      ]);
      return managers
        .filter((m) => m.id && m.id !== userId)
        .map((m) => ({
          id: m.id!,
          email: m.email,
          fullName: m.fullName ?? null,
          role: m.role,
        }));
    }

    const teams = await this.userRepo.findMany({
      role: UserRole.DISPATCH_TEAM,
      status: UserStatus.ACTIVE,
    });
    const managers = await this.userRepo.findActiveByRoles([
      UserRole.DISPATCH_MANAGER,
      UserRole.ADMIN,
    ]);

    const peers = [...teams, ...managers].filter((u) => u.id && u.id !== userId);
    return peers.map((u) => ({
      id: u.id!,
      email: u.email,
      fullName: u.fullName ?? null,
      role: u.role,
      assignedCity: u.assignedCity ?? null,
    }));
  }

  async openConversationForDriver(driverId: string) {
    const activeRoutes = await this.routeRepo.findManyByDriverId(driverId, {
      status: [RouteStatus.ASSIGNED, RouteStatus.ACTIVE, RouteStatus.IN_PROGRESS],
    });
    const route = activeRoutes[0];
    let opsUserId: string | null = null;

    if (route) {
      const schedule = await this.scheduleRepo.findById(route.scheduleId);
      if (schedule?.city) {
        const teamMember = await this.userRepo.findActiveDispatchTeamByCity(schedule.city);
        if (teamMember?.id) opsUserId = teamMember.id;
      }
    }

    if (!opsUserId) {
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
        throw new AppError('No dispatch ops available for chat.', 503);
      }
      opsUserId = manager.id;
    }

    await this.getOrCreateConversation(opsUserId, driverId);
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

    const objectUserId = new Types.ObjectId(userId);
    const readResult = await MessageModel.updateMany(
      { conversationId, readBy: { $ne: objectUserId } },
      { $addToSet: { readBy: objectUserId, deliveredTo: objectUserId } }
    );

    if (readResult.modifiedCount > 0) {
      emitMessagesRead({ conversationId, readerId: String(userId) });
      emitMessagesDelivered({ conversationId, userId: String(userId) });
    }

    return rows.reverse().map((m) => {
      const readBy = (m.readBy ?? []).map(String);
      const deliveredTo = (m.deliveredTo ?? []).map(String);
      if (!readBy.includes(String(userId))) readBy.push(String(userId));
      if (!deliveredTo.includes(String(userId))) deliveredTo.push(String(userId));
      return {
        id: String(m._id),
        conversationId: String(m.conversationId),
        senderId: String(m.senderId),
        body: m.body,
        type: m.type,
        meta: m.meta ?? {},
        readBy,
        deliveredTo,
        createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
      };
    });
  }

  async markConversationsDelivered(
    userId: string,
    role: UserRole | null,
    conversationId?: string
  ) {
    const base = this.conversationFilter(userId, role);
    if ('_id' in base && base._id === null) return [];

    const filter = conversationId ? { ...base, _id: conversationId } : base;
    const convs = await ConversationModel.find(filter).select('_id').lean();

    const objectUserId = new Types.ObjectId(userId);
    const affected: string[] = [];

    for (const c of convs) {
      const result = await MessageModel.updateMany(
        {
          conversationId: c._id,
          senderId: { $ne: objectUserId },
          deliveredTo: { $ne: objectUserId },
        },
        { $addToSet: { deliveredTo: objectUserId } }
      );
      if (result.modifiedCount > 0) {
        const cid = String(c._id);
        affected.push(cid);
        emitMessagesDelivered({ conversationId: cid, userId: String(userId) });
      }
    }

    return affected;
  }

  private recipientIdForSender(
    conv: { managerId: Types.ObjectId; driverId: Types.ObjectId; kind?: string },
    senderId: string,
    senderRole: UserRole | null
  ) {
    const mid = String(conv.managerId);
    const did = String(conv.driverId);
    if (conv.kind === 'internal') {
      return senderId === mid ? did : mid;
    }
    return isOps(senderRole) ? did : mid;
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
      deliveredTo: [params.senderId],
      readBy: [params.senderId],
    });

    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = params.body.slice(0, 120);
    conv.lastSenderId = new Types.ObjectId(params.senderId);
    await conv.save();

    const recipientId = this.recipientIdForSender(conv, params.senderId, params.senderRole);

    return {
      id: String(msg._id),
      conversationId: String(conv._id),
      senderId: params.senderId,
      body: msg.body,
      type: msg.type,
      meta: {},
      deliveredTo: [params.senderId],
      readBy: [params.senderId],
      createdAt: msg.createdAt?.toISOString?.() ?? msg.createdAt,
      recipientId,
    };
  }

  async sendVoiceMessage(params: {
    conversationId: string;
    senderId: string;
    senderRole: UserRole | null;
    audioUrl: string;
    durationMs: number;
  }) {
    if (!params.audioUrl) throw new AppError('Audio file is required.', 400);

    const conv = await ConversationModel.findById(params.conversationId);
    if (!conv) throw new AppError('Conversation not found.', 404);

    const allowed = await this.userInConversation(
      params.senderId,
      params.senderRole,
      params.conversationId
    );
    if (!allowed) throw new AppError('Access denied.', 403);

    const meta = { audioUrl: params.audioUrl, durationMs: params.durationMs };
    const msg = await MessageModel.create({
      conversationId: conv._id,
      senderId: params.senderId,
      body: 'Voice message',
      type: 'voice',
      meta,
      deliveredTo: [params.senderId],
      readBy: [params.senderId],
    });

    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = '🎤 Voice message';
    conv.lastSenderId = new Types.ObjectId(params.senderId);
    await conv.save();

    const recipientId = this.recipientIdForSender(conv, params.senderId, params.senderRole);

    return {
      id: String(msg._id),
      conversationId: String(conv._id),
      senderId: params.senderId,
      body: msg.body,
      type: msg.type,
      meta,
      deliveredTo: [params.senderId],
      readBy: [params.senderId],
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

    let opsUserId = String(route.assignedBy);
    const schedule = await this.scheduleRepo.findById(route.scheduleId);
    if (schedule?.city) {
      const teamMember = await this.userRepo.findActiveDispatchTeamByCity(schedule.city);
      if (teamMember?.id) opsUserId = teamMember.id;
    }

    const conv = await this.getOrCreateConversation(opsUserId, params.driverId);

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
      deliveredTo: [params.driverId],
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
      deliveredTo: [params.driverId],
      readBy: [params.driverId],
      createdAt: msg.createdAt,
    };

    emitDeliveryPhotoAlert({
      conversationId: String(conv._id),
      managerId: opsUserId,
      driverId: params.driverId,
      message: payload,
    });
  }
}
