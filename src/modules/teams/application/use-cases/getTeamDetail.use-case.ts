import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { UserRole } from '../../../../shared/constants/roles';
import { AppError } from '../../../../shared/errors/app-error';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { ITeamRepository } from '../../domain/interfaces/team-repository.interface';

export class GetTeamDetailUseCase {
  constructor(
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(teamId: string) {
    const team = await this.teamRepo.findById(teamId);
    if (!team) throw new AppError('Team not found', 404);

    const members = await this.userRepo.findManyByTeamId(teamId);

    let teamLead: {
      id: string;
      email: string;
      displayName: string;
      role: string;
    } | null = null;

    if (team.teamLeadId) {
      const lead = await this.userRepo.findById(team.teamLeadId);
      if (lead) {
        teamLead = {
          id: lead.id!,
          email: lead.email,
          displayName: resolveDisplayName(lead.fullName, lead.email),
          role: lead.role ?? UserRole.TEAM_LEAD,
        };
      }
    }

    const drivers = members
      .filter((m) => m.role === UserRole.DRIVER)
      .map((m) => ({
        id: m.id,
        email: m.email,
        displayName: resolveDisplayName(m.fullName, m.email),
        role: m.role,
        status: m.status,
      }));

    const otherMembers = members
      .filter((m) => m.role !== UserRole.DRIVER)
      .map((m) => ({
        id: m.id,
        email: m.email,
        displayName: resolveDisplayName(m.fullName, m.email),
        role: m.role,
        status: m.status,
      }));

    return {
      id: team.id,
      name: team.name,
      code: team.code,
      teamLeadId: team.teamLeadId,
      teamLead,
      drivers,
      driverCount: drivers.length,
      members: otherMembers,
      memberCount: members.length,
      createdBy: team.createdBy,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }
}
