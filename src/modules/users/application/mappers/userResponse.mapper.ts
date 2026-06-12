import { User } from '../../../auth/domain/entities/user.entity';
import { UserRole } from '../../../../shared/constants/roles';
import { roleRequiresCity, roleRequiresTeam } from '../../../../shared/constants/roleRequirements';
import { resolveDisplayName } from '../../../../shared/utils/displayName';

export type UserTeamBrief = {
  id: string;
  name: string;
  code: string;
  teamLeadId: string | null;
} | null;

export function resolveUserAssignedCities(user: User): string[] {
  if (user.role !== UserRole.DISPATCH_TEAM) {
    const city = user.assignedCity?.trim();
    return city ? [city] : [];
  }

  const fromArray = (user.assignedCities ?? [])
    .map((city) => city?.trim())
    .filter(Boolean) as string[];
  if (fromArray.length > 0) return fromArray;

  const legacy = user.assignedCity?.trim();
  return legacy ? [legacy] : [];
}

export function mapUserToResponse(
  user: User,
  team?: UserTeamBrief
) {
  const assignedCities = resolveUserAssignedCities(user);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    displayName: resolveDisplayName(user.fullName, user.email),
    role: user.role,
    status: user.status,
    teamId: user.teamId,
    assignedCity: user.role === UserRole.DISPATCH_TEAM ? assignedCities[0] ?? null : user.assignedCity,
    assignedCities: user.role === UserRole.DISPATCH_TEAM ? assignedCities : [],
    team,
    requiresTeam: user.role ? roleRequiresTeam(user.role) : false,
    requiresCity: user.role ? roleRequiresCity(user.role) : false,
    pendingRoleAssignment: user.status === 'pending' && !user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
