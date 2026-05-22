import { UserRole } from '../constants/roles';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './role.middleware';

/** Drivers and team drivers (field roles). */
export const driverGuard = [
  requireAuth(),
  requireRoles(UserRole.DRIVER, UserRole.TEAM_DRIVER),
];
