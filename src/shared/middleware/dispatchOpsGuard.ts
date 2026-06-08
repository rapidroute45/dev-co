import { UserRole } from '../constants/roles';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './role.middleware';

/** Admin, dispatch manager, and city-scoped dispatch team. */
export const dispatchOpsGuard = [
  requireAuth(),
  requireRoles(UserRole.ADMIN, UserRole.DISPATCH_MANAGER, UserRole.DISPATCH_TEAM),
];
