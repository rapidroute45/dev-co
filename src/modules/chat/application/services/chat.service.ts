import { Types } from 'mongoose';
import { AppError } from '../../../../shared/errors/app-error';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { User } from '../../../auth/domain/entities/user.entity';
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
const GROUP_CREATOR_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.DISPATCH_TEAM,
  UserRole.TEAM_LEAD,
  UserRole.TEAM_DRIVER,
];

function isOps(role: UserRole | null | undefined) {
  return role != null && OPS_CHAT_ROLES.includes(role);
}

function isDriver(role: UserRole | null | undefined) {
  return role != null && DRIVER_ROLES.includes(role);
}

type UserSummary = {
  id: string;
  email: string;
  fullName?: string | null;
  role?: UserRole | null;
  phone?: string | null;
};

function displayNameOf(u?: UserSummary | null) {
  return u?.fullName?.trim() || u?.email || 'User';
}

export class ChatService {
  constructor(
    private userRepo: UserRepository,
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository
  ) {}

  private async getUserMap(ids: string[]) {
    const unique = [...new Set(ids.map(String))].filter(Boolean);
    const users = await Promise.all(unique.map((id) => this.userRepo.findById(id)));
    const map = new Map<string, UserSummary>();
    users.forEach((u, i) => {
      if (u) {
        map.set(unique[i], {
          id: unique[i],
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          phone: u.phone ?? null,
        });
      }
    });
    return map;
  }

  /** Effective membership for a conversation (groups use participants; 1:1 falls back to the pair). */
  private participantsOf(conv: {
    managerId?: Types.ObjectId | null;
    driverId?: Types.ObjectId | null;
    participants?: Types.ObjectId[] | null;
    kind?: string;
  }): string[] {
    if (conv.kind === 'group') {
      return (conv.participants ?? []).map(String);
    }
    const ids = (conv.participants ?? []).map(String);
    if (ids.length) return ids;
    const pair: string[] = [];
    if (conv.managerId) pair.push(String(conv.managerId));
    if (conv.driverId) pair.push(String(conv.driverId));
    return pair;
  }

  private conversationFilter(userId: string, role: UserRole | null): Record<string, unknown> {
    if (isOps(role)) {
      return {
        $or: [
          { managerId: userId },
          { driverId: userId, kind: 'internal' as const },
          { kind: 'group' as const, participants: userId },
        ],
      };
    }
    if (isDriver(role)) {
      return {
        $or: [
          { driverId: userId, $or: [{ kind: 'driver' as const }, { kind: { $exists: false } }] },
          { kind: 'group' as const, participants: userId },
        ],
      };
    }
    // Team lead and others: only group conversations they belong to.
    return { kind: 'group' as const, participants: userId };
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
    const uid = String(userId);

    if (conv.kind === 'group') {
      return this.participantsOf(conv).includes(uid);
    }

    const mid = String(conv.managerId);
    const did = String(conv.driverId);
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
        participants: [opsUserId, driverId],
      });
    } else if (!conv.participants || conv.participants.length === 0) {
      conv.participants = [new Types.ObjectId(opsUserId), new Types.ObjectId(driverId)];
      await conv.save();
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
        participants: pair,
      });
    } else if (!conv.participants || conv.participants.length === 0) {
      conv.participants = pair.map((id) => new Types.ObjectId(id));
      await conv.save();
    }
    return conv;
  }

  async listConversations(userId: string, role: UserRole | null) {
    const filter = this.conversationFilter(userId, role);

    const rows = await ConversationModel.find(filter)
      .sort({ lastMessageAt: -1 })
      .lean();

    // Collect every id we need to resolve (1:1 "other" + group members).
    const idsToResolve = new Set<string>();
    for (const c of rows) {
      if (c.kind === 'group') {
        for (const p of this.participantsOf(c)) idsToResolve.add(p);
      } else {
        const mid = String(c.managerId);
        const did = String(c.driverId);
        idsToResolve.add(mid === String(userId) ? did : mid);
      }
    }
    const userMap = await this.getUserMap([...idsToResolve]);
    const uid = String(userId);

    return rows.map((c) => {
      if (c.kind === 'group') {
        const memberIds = this.participantsOf(c);
        const members = memberIds.map((id) => {
          const u = userMap.get(id);
          return {
            id,
            name: displayNameOf(u),
            email: u?.email ?? '',
            role: u?.role ?? null,
            phone: u?.phone ?? null,
          };
        });
        return {
          id: String(c._id),
          kind: 'group' as const,
          isGroup: true,
          title: c.title ?? 'Group',
          otherUserId: null,
          otherName: c.title ?? 'Group',
          otherEmail: '',
          otherRole: null,
          otherPhone: null,
          createdBy: c.createdBy ? String(c.createdBy) : null,
          admins: (c.admins ?? []).map(String),
          members,
          memberCount: members.length,
          lastMessageAt: c.lastMessageAt,
          lastMessagePreview: c.lastMessagePreview ?? '',
          lastSenderId: c.lastSenderId ? String(c.lastSenderId) : null,
        };
      }

      const mid = String(c.managerId);
      const did = String(c.driverId);
      const otherId =
        c.kind === 'internal' ? (mid === uid ? did : mid) : isOps(role) ? did : mid;
      const other = userMap.get(otherId);
      return {
        id: String(c._id),
        managerId: mid,
        driverId: did,
        kind: c.kind ?? 'driver',
        isGroup: false,
        title: null,
        otherUserId: otherId,
        otherName: displayNameOf(other),
        otherEmail: other?.email ?? '',
        otherRole: other?.role ?? null,
        otherPhone: other?.phone ?? null,
        members: [],
        memberCount: 2,
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview ?? '',
        lastSenderId: c.lastSenderId ? String(c.lastSenderId) : null,
      };
    });
  }

  async listDriversForOps(actorRole: UserRole | null, _assignedCity?: string | null) {
    if (!isOps(actorRole)) throw new AppError('Ops roles only.', 403);
    const drivers = await this.userRepo.findActiveDrivers();
    return drivers.map((d) => ({
      id: d.id!,
      email: d.email,
      fullName: d.fullName ?? null,
      role: d.role,
      phone: d.phone ?? null,
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
          phone: m.phone ?? null,
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
      phone: u.phone ?? null,
    }));
  }

  /** Users a given creator is allowed to add to a group (excludes the creator). */
  private async getAddableUsers(creator: User): Promise<User[]> {
    const creatorId = creator.id!;
    const role = creator.role;

    if (role === UserRole.ADMIN || role === UserRole.DISPATCH_MANAGER) {
      const all = await this.userRepo.findMany({ status: UserStatus.ACTIVE });
      return all.filter((u) => u.id && u.id !== creatorId);
    }

    if (role === UserRole.DISPATCH_TEAM) {
      const all = await this.userRepo.findMany({ status: UserStatus.ACTIVE });
      // Anyone except other dispatch-team members.
      return all.filter(
        (u) => u.id && u.id !== creatorId && u.role !== UserRole.DISPATCH_TEAM
      );
    }

    if (role === UserRole.TEAM_LEAD || role === UserRole.TEAM_DRIVER) {
      if (!creator.teamId) return [];
      const members = await this.userRepo.findManyByTeamId(creator.teamId);
      return members.filter(
        (u) => u.id && u.id !== creatorId && u.status === UserStatus.ACTIVE
      );
    }

    return [];
  }

  async listGroupCandidates(creatorId: string, role: UserRole | null) {
    if (!role || !GROUP_CREATOR_ROLES.includes(role)) {
      throw new AppError('You cannot create groups.', 403);
    }
    const creator = await this.userRepo.findById(creatorId);
    if (!creator) throw new AppError('User not found.', 404);

    const users = await this.getAddableUsers(creator);
    return users.map((u) => ({
      id: u.id!,
      email: u.email,
      fullName: u.fullName ?? null,
      role: u.role,
      teamId: u.teamId ?? null,
      phone: u.phone ?? null,
    }));
  }

  async createGroup(params: {
    creatorId: string;
    creatorRole: UserRole | null;
    title: string;
    memberIds: string[];
  }) {
    if (!params.creatorRole || !GROUP_CREATOR_ROLES.includes(params.creatorRole)) {
      throw new AppError('You cannot create groups.', 403);
    }
    const title = params.title?.trim();
    if (!title) throw new AppError('Group name is required.', 400);

    const creator = await this.userRepo.findById(params.creatorId);
    if (!creator) throw new AppError('User not found.', 404);

    const addable = await this.getAddableUsers(creator);
    const addableIds = new Set(addable.map((u) => u.id!));
    const requested = [...new Set((params.memberIds ?? []).map(String))].filter(
      (id) => id && id !== params.creatorId
    );

    const invalid = requested.filter((id) => !addableIds.has(id));
    if (invalid.length) {
      throw new AppError('You are not allowed to add one or more selected members.', 403);
    }
    if (requested.length === 0) {
      throw new AppError('Add at least one member.', 400);
    }

    const participants = [params.creatorId, ...requested];
    const conv = await ConversationModel.create({
      kind: 'group',
      title,
      createdBy: params.creatorId,
      admins: [params.creatorId],
      participants,
      lastMessageAt: new Date(),
      lastMessagePreview: `${displayNameOf({
        id: creator.id!,
        email: creator.email,
        fullName: creator.fullName,
      })} created "${title}"`,
      lastSenderId: params.creatorId,
    });

    await MessageModel.create({
      conversationId: conv._id,
      senderId: params.creatorId,
      body: `${displayNameOf({
        id: creator.id!,
        email: creator.email,
        fullName: creator.fullName,
      })} created the group "${title}"`,
      type: 'system',
      deliveredTo: [params.creatorId],
      readBy: [params.creatorId],
    });

    const list = await this.listConversations(params.creatorId, params.creatorRole);
    return list.find((c) => c.id === String(conv._id)) ?? null;
  }

  async updateGroup(params: {
    conversationId: string;
    actorId: string;
    actorRole: UserRole | null;
    title?: string;
    addMemberIds?: string[];
    removeMemberIds?: string[];
  }) {
    const conv = await ConversationModel.findById(params.conversationId);
    if (!conv || conv.kind !== 'group') throw new AppError('Group not found.', 404);

    const admins = (conv.admins ?? []).map(String);
    if (!admins.includes(String(params.actorId))) {
      throw new AppError('Only group admins can edit the group.', 403);
    }

    const actor = await this.userRepo.findById(params.actorId);
    if (!actor) throw new AppError('User not found.', 404);

    const systemMessages: string[] = [];

    if (params.title !== undefined) {
      const title = params.title.trim();
      if (!title) throw new AppError('Group name cannot be empty.', 400);
      if (title !== conv.title) {
        conv.title = title;
        systemMessages.push(`${displayNameOf(actor as unknown as UserSummary)} renamed the group to "${title}"`);
      }
    }

    if (params.addMemberIds?.length) {
      const addable = await this.getAddableUsers(actor);
      const addableIds = new Set(addable.map((u) => u.id!));
      const current = new Set(this.participantsOf(conv));
      const toAdd = [...new Set(params.addMemberIds.map(String))].filter(
        (id) => !current.has(id)
      );
      const invalid = toAdd.filter((id) => !addableIds.has(id));
      if (invalid.length) {
        throw new AppError('You are not allowed to add one or more selected members.', 403);
      }
      for (const id of toAdd) conv.participants.push(new Types.ObjectId(id));
      if (toAdd.length) {
        const addedMap = await this.getUserMap(toAdd);
        const names = toAdd.map((id) => displayNameOf(addedMap.get(id))).join(', ');
        systemMessages.push(`${displayNameOf(actor as unknown as UserSummary)} added ${names}`);
      }
    }

    if (params.removeMemberIds?.length) {
      const removeSet = new Set(params.removeMemberIds.map(String));
      // Cannot remove the creator.
      removeSet.delete(String(conv.createdBy));
      const removedMap = await this.getUserMap([...removeSet]);
      conv.participants = conv.participants.filter(
        (p) => !removeSet.has(String(p))
      );
      conv.admins = (conv.admins ?? []).filter((a) => !removeSet.has(String(a)));
      const names = [...removeSet].map((id) => displayNameOf(removedMap.get(id))).join(', ');
      if (names) systemMessages.push(`${displayNameOf(actor as unknown as UserSummary)} removed ${names}`);
    }

    if (systemMessages.length) {
      conv.lastMessageAt = new Date();
      conv.lastMessagePreview = systemMessages[systemMessages.length - 1];
      conv.lastSenderId = new Types.ObjectId(params.actorId);
    }
    await conv.save();

    for (const text of systemMessages) {
      await MessageModel.create({
        conversationId: conv._id,
        senderId: params.actorId,
        body: text,
        type: 'system',
        deliveredTo: [params.actorId],
        readBy: [params.actorId],
      });
    }

    const list = await this.listConversations(params.actorId, params.actorRole);
    return list.find((c) => c.id === String(conv._id)) ?? null;
  }

  async leaveGroup(params: {
    conversationId: string;
    actorId: string;
  }) {
    const conv = await ConversationModel.findById(params.conversationId);
    if (!conv || conv.kind !== 'group') throw new AppError('Group not found.', 404);

    const actor = await this.userRepo.findById(params.actorId);
    conv.participants = conv.participants.filter(
      (p) => String(p) !== String(params.actorId)
    );
    conv.admins = (conv.admins ?? []).filter(
      (a) => String(a) !== String(params.actorId)
    );

    if (conv.participants.length === 0) {
      await MessageModel.deleteMany({ conversationId: conv._id });
      await conv.deleteOne();
      return { left: true, deleted: true };
    }

    // Keep at least one admin.
    if ((conv.admins ?? []).length === 0 && conv.participants.length) {
      conv.admins = [conv.participants[0]];
    }

    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = `${displayNameOf(actor as unknown as UserSummary)} left the group`;
    conv.lastSenderId = new Types.ObjectId(params.actorId);
    await conv.save();

    await MessageModel.create({
      conversationId: conv._id,
      senderId: params.actorId,
      body: `${displayNameOf(actor as unknown as UserSummary)} left the group`,
      type: 'system',
      deliveredTo: [params.actorId],
      readBy: [params.actorId],
    });

    return { left: true, deleted: false };
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

    const senderMap = await this.getUserMap(rows.map((m) => String(m.senderId)));

    return rows.reverse().map((m) => {
      const readBy = (m.readBy ?? []).map(String);
      const deliveredTo = (m.deliveredTo ?? []).map(String);
      if (!readBy.includes(String(userId))) readBy.push(String(userId));
      if (!deliveredTo.includes(String(userId))) deliveredTo.push(String(userId));
      const sender = senderMap.get(String(m.senderId));
      return {
        id: String(m._id),
        conversationId: String(m.conversationId),
        senderId: String(m.senderId),
        senderName: displayNameOf(sender),
        senderRole: sender?.role ?? null,
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

  private async buildOutgoingMessage(params: {
    conv: InstanceType<typeof ConversationModel>;
    senderId: string;
    body: string;
    type: 'text' | 'voice' | 'document';
    meta?: Record<string, unknown>;
    preview: string;
  }) {
    const { conv } = params;
    const msg = await MessageModel.create({
      conversationId: conv._id,
      senderId: params.senderId,
      body: params.body,
      type: params.type,
      meta: params.meta ?? {},
      deliveredTo: [params.senderId],
      readBy: [params.senderId],
    });

    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = params.preview.slice(0, 120);
    conv.lastSenderId = new Types.ObjectId(params.senderId);
    await conv.save();

    const sender = await this.userRepo.findById(params.senderId);
    const participantIds = this.participantsOf(conv).filter(
      (id) => id !== String(params.senderId)
    );

    return {
      id: String(msg._id),
      conversationId: String(conv._id),
      senderId: params.senderId,
      senderName: displayNameOf(sender as unknown as UserSummary),
      senderRole: sender?.role ?? null,
      body: msg.body,
      type: msg.type,
      meta: params.meta ?? {},
      deliveredTo: [params.senderId],
      readBy: [params.senderId],
      createdAt: msg.createdAt?.toISOString?.() ?? msg.createdAt,
      recipientId: participantIds[0] ?? '',
      participantIds,
    };
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

    return this.buildOutgoingMessage({
      conv,
      senderId: params.senderId,
      body: params.body,
      type: 'text',
      preview: params.body,
    });
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

    return this.buildOutgoingMessage({
      conv,
      senderId: params.senderId,
      body: 'Voice message',
      type: 'voice',
      meta: { audioUrl: params.audioUrl, durationMs: params.durationMs },
      preview: '🎤 Voice message',
    });
  }

  async sendDocumentMessage(params: {
    conversationId: string;
    senderId: string;
    senderRole: UserRole | null;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }) {
    if (!params.fileUrl) throw new AppError('File is required.', 400);

    const conv = await ConversationModel.findById(params.conversationId);
    if (!conv) throw new AppError('Conversation not found.', 404);

    const allowed = await this.userInConversation(
      params.senderId,
      params.senderRole,
      params.conversationId
    );
    if (!allowed) throw new AppError('Access denied.', 403);

    return this.buildOutgoingMessage({
      conv,
      senderId: params.senderId,
      body: params.fileName || 'Document',
      type: 'document',
      meta: {
        fileUrl: params.fileUrl,
        fileName: params.fileName,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
      },
      preview: `📄 ${params.fileName || 'Document'}`,
    });
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
