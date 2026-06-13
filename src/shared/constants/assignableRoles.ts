import { UserRole } from './roles';

/** Roles a dispatch manager may assign (not dispatch manager / admin). */
export const DISPATCH_MANAGER_ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.DISPATCH_TEAM,
  UserRole.TEAM_LEAD,
  UserRole.TEAM_DRIVER,
  UserRole.DRIVER,
  UserRole.ACCOUNTANT,
];

/** Admin may assign any role. */
export const ADMIN_ASSIGNABLE_ROLES: UserRole[] = Object.values(UserRole);

export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === UserRole.ADMIN) return true;
  if (actorRole === UserRole.DISPATCH_MANAGER) {
    return DISPATCH_MANAGER_ASSIGNABLE_ROLES.includes(targetRole);
  }
  return false;
}
