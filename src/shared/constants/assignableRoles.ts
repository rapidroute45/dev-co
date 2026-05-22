import { UserRole } from './roles';

/** Roles dispatch manager may assign when creating/updating users. */
export const DISPATCH_MANAGER_ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.TEAM_LEAD,
  UserRole.TEAM_DRIVER,
  UserRole.DRIVER,
  UserRole.ACCOUNTANT,
];

/** Admin may assign any role except creating duplicate admins casually — all roles. */
export const ADMIN_ASSIGNABLE_ROLES: UserRole[] = Object.values(UserRole);

export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === UserRole.ADMIN) return true;
  if (actorRole === UserRole.DISPATCH_MANAGER) {
    return DISPATCH_MANAGER_ASSIGNABLE_ROLES.includes(targetRole);
  }
  return false;
}
