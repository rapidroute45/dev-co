import {
  IUserRepository,
  ApproveUserUpdate,
  UserListFilters,
  UserUpdateData,
} from '../../domain/interfaces/user-repository.interface';
import { User } from '../../domain/entities/user.entity';
import { UserModel } from '../models/user.model';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';

function mapDoc(doc: {
  _id: { toString(): string };
  email: string;
  password: string;
  fullName?: string | null;
  phone?: string | null;
  role?: string | null;
  status: string;
  teamId?: { toString(): string } | null;
  assignedCity?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}): User {
  return new User({
    id: doc._id.toString(),
    email: doc.email,
    passwordHash: doc.password,
    fullName: doc.fullName ?? null,
    phone: doc.phone ?? null,
    role: (doc.role as UserRole) ?? null,
    status: doc.status as UserStatus,
    teamId: doc.teamId?.toString() ?? null,
    assignedCity: doc.assignedCity ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

function buildListQuery(filters?: UserListFilters) {
  const query: Record<string, unknown> = {};

  if (filters?.status) query.status = filters.status;
  if (filters?.role) query.role = filters.role;
  if (filters?.teamId) query.teamId = filters.teamId;
  if (filters?.pendingApproval) {
    query.status = UserStatus.PENDING;
  }
  if (filters?.search?.trim()) {
    const term = filters.search.trim();
    query.$or = [
      { email: { $regex: term, $options: 'i' } },
      { fullName: { $regex: term, $options: 'i' } },
    ];
  }

  return query;
}

export class UserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase().trim() });
    return doc ? mapDoc(doc) : null;
  }

  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id);
    return doc ? mapDoc(doc) : null;
  }

  async findMany(filters?: UserListFilters): Promise<User[]> {
    const docs = await UserModel.find(buildListQuery(filters)).sort({ createdAt: -1 });
    return docs.map(mapDoc);
  }

  async findActiveByRoles(roles: UserRole[]): Promise<User[]> {
    if (roles.length === 0) return [];
    const docs = await UserModel.find({
      status: UserStatus.ACTIVE,
      role: { $in: roles },
    }).sort({ fullName: 1, email: 1 });
    return docs.map(mapDoc);
  }

  async findActiveDrivers(): Promise<User[]> {
    const docs = await UserModel.find({
      status: UserStatus.ACTIVE,
      role: { $in: [UserRole.DRIVER, UserRole.TEAM_DRIVER] },
    }).sort({ fullName: 1, email: 1 });
    return docs.map(mapDoc);
  }

  async findManyByStatus(status: UserStatus): Promise<User[]> {
    return this.findMany({ status });
  }

  async findManyByTeamId(teamId: string): Promise<User[]> {
    const docs = await UserModel.find({ teamId });
    return docs.map(mapDoc);
  }

  async findActiveDispatchTeamByCity(city: string): Promise<User | null> {
    const trimmed = city.trim();
    if (!trimmed) return null;
    const doc = await UserModel.findOne({
      role: UserRole.DISPATCH_TEAM,
      status: UserStatus.ACTIVE,
      assignedCity: { $regex: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    return doc ? mapDoc(doc) : null;
  }

  async save(user: User): Promise<User> {
    const created = await UserModel.create({
      email: user.email,
      password: user.passwordHash,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      teamId: user.teamId ?? null,
      assignedCity: user.assignedCity ?? null,
    });
    return mapDoc(created);
  }

  async updateAfterApproval(update: ApproveUserUpdate): Promise<User | null> {
    return this.update(update.userId, {
      role: update.role,
      status: update.status,
      teamId: update.teamId ?? null,
      assignedCity: update.assignedCity ?? null,
    });
  }

  async update(userId: string, data: UserUpdateData): Promise<User | null> {
    const patch: Record<string, unknown> = {};
    if (data.email !== undefined) patch.email = data.email.toLowerCase().trim();
    if (data.fullName !== undefined) patch.fullName = data.fullName;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.role !== undefined) patch.role = data.role;
    if (data.status !== undefined) patch.status = data.status;
    if (data.teamId !== undefined) patch.teamId = data.teamId;
    if (data.assignedCity !== undefined) patch.assignedCity = data.assignedCity;
    if (data.passwordHash !== undefined) patch.password = data.passwordHash;

    const doc = await UserModel.findByIdAndUpdate(userId, patch, {
      returnDocument: 'after',
    });
    return doc ? mapDoc(doc) : null;
  }

  async updateTeamId(userId: string, teamId: string | null): Promise<User | null> {
    return this.update(userId, { teamId });
  }

  async delete(userId: string): Promise<boolean> {
    const result = await UserModel.findByIdAndDelete(userId);
    return result != null;
  }

  async clearTeamFromUsers(teamId: string): Promise<number> {
    const result = await UserModel.updateMany(
      { teamId },
      { $set: { teamId: null } }
    );
    return result.modifiedCount;
  }
}
