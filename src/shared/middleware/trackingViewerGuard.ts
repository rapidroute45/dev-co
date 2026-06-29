import { UserRole } from '../constants/roles';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './role.middleware';

/** Live route map — dispatch ops only. */
export const trackingViewerGuard = [
  requireAuth(),
  requireRoles(UserRole.ADMIN, UserRole.DISPATCH_MANAGER, UserRole.DISPATCH_TEAM),
];
