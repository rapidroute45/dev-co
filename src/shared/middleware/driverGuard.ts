import { UserRole } from '../constants/roles';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './role.middleware';

/** Field roles that drive routes: drivers, team drivers, and team leads. */
export const driverGuard = [
  requireAuth(),
  requireRoles(UserRole.DRIVER, UserRole.TEAM_DRIVER, UserRole.TEAM_LEAD),
];
