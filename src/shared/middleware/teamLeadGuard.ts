import { UserRole } from '../constants/roles';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './role.middleware';

/** Team leads: manager-style access scoped to their own team. */
export const teamLeadGuard = [
  requireAuth(),
  requireRoles(UserRole.TEAM_LEAD),
];
