import { UserRole } from './roles';

export const ROLES_REQUIRING_TEAM: UserRole[] = [
  UserRole.TEAM_LEAD,
  UserRole.TEAM_DRIVER,
  UserRole.DRIVER,
];

export const ROLES_REQUIRING_CITY: UserRole[] = [
  UserRole.DISPATCH_TEAM,
  UserRole.TEAM_LEAD,
];

export function roleRequiresTeam(role: UserRole): boolean {
  return ROLES_REQUIRING_TEAM.includes(role);
}

export function roleRequiresCity(role: UserRole): boolean {
  return ROLES_REQUIRING_CITY.includes(role);
}
