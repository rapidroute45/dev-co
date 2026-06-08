import { User } from '../entities/user.entity';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';

export interface ApproveUserUpdate {
  userId: string;
  role: UserRole;
  status: UserStatus;
  teamId?: string | null;
  assignedCity?: string | null;
}

export interface UserListFilters {
  status?: UserStatus;
  role?: UserRole;
  teamId?: string;
  search?: string;
  pendingApproval?: boolean;
}

export interface UserUpdateData {
  email?: string;
  fullName?: string | null;
  phone?: string | null;
  role?: UserRole | null;
  status?: UserStatus;
  teamId?: string | null;
  assignedCity?: string | null;
  passwordHash?: string;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findMany(filters?: UserListFilters): Promise<User[]>;
  /** Active users whose role is in `roles` (e.g. dispatch manager + admin for dwell alerts). */
  findActiveByRoles(roles: UserRole[]): Promise<User[]>;
  findActiveDrivers(): Promise<User[]>;
  findManyByStatus(status: UserStatus): Promise<User[]>;
  findManyByTeamId(teamId: string): Promise<User[]>;
  findActiveDispatchTeamByCity(city: string): Promise<User | null>;
  save(user: User): Promise<User>;
  updateAfterApproval(update: ApproveUserUpdate): Promise<User | null>;
  update(userId: string, data: UserUpdateData): Promise<User | null>;
  updateTeamId(userId: string, teamId: string | null): Promise<User | null>;
  delete(userId: string): Promise<boolean>;
  clearTeamFromUsers(teamId: string): Promise<number>;
}
