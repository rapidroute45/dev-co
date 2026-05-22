import { UserRole } from '../constants/roles';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './role.middleware';

/** Admin and dispatch manager only. */
export const managerGuard = [
  requireAuth(),
  requireRoles(UserRole.ADMIN, UserRole.DISPATCH_MANAGER),
];
