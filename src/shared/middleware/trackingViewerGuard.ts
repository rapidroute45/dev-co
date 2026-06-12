import { UserRole } from '../constants/roles';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './role.middleware';

/** Live driver map + route tracking for dispatch operations staff. */
export const trackingViewerGuard = [
  requireAuth(),
  requireRoles(UserRole.ADMIN, UserRole.DISPATCH_MANAGER, UserRole.DISPATCH_TEAM),
];
