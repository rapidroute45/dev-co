import { User } from '../../../auth/domain/entities/user.entity';
import { roleRequiresCity, roleRequiresTeam } from '../../../../shared/constants/roleRequirements';
import { resolveDisplayName } from '../../../../shared/utils/displayName';

export type UserTeamBrief = {
  id: string;
  name: string;
  code: string;
  teamLeadId: string | null;
} | null;

export function mapUserToResponse(
  user: User,
  team?: UserTeamBrief
) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    displayName: resolveDisplayName(user.fullName, user.email),
    role: user.role,
    status: user.status,
    teamId: user.teamId,
    assignedCity: user.assignedCity,
    team,
    requiresTeam: user.role ? roleRequiresTeam(user.role) : false,
    requiresCity: user.role ? roleRequiresCity(user.role) : false,
    pendingRoleAssignment: user.status === 'pending' && !user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
