import { UserRole } from '../constants/roles';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './role.middleware';

/** Ops staff plus team leads (team leads are scoped to their own team in controllers). */
export const managerOrTeamLeadGuard = [
  requireAuth(),
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCH_MANAGER,
    UserRole.DISPATCH_TEAM,
    UserRole.TEAM_LEAD
  ),
];
