import { UserRole } from '../constants/roles';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './role.middleware';

/** Dispatch staff plus team leads (team leads are scoped to their own team in the controller). */
export const managerOrTeamLeadGuard = [
  requireAuth(),
  requireRoles(UserRole.ADMIN, UserRole.DISPATCH_MANAGER, UserRole.TEAM_LEAD),
];
