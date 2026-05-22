import { UserRole } from './roles';

/** Roles that must be linked to a team when approved by admin / dispatch manager. */
export const ROLES_REQUIRING_TEAM: UserRole[] = [
  UserRole.TEAM_LEAD,
  UserRole.TEAM_DRIVER,
  UserRole.DRIVER,
];

export function roleRequiresTeam(role: UserRole): boolean {
  return ROLES_REQUIRING_TEAM.includes(role);
}
