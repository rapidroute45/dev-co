import { UserRole } from '../constants/roles';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './role.middleware';

/** Schedules/routes read access for dispatch staff and field roles. */
export const scheduleViewerGuard = [
  requireAuth(),
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TEAM_LEAD,
    UserRole.DRIVER,
    UserRole.TEAM_DRIVER
  ),
];
