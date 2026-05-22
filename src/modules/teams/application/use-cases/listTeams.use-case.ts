import { UserRole } from '../../../../shared/constants/roles';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../domain/interfaces/team-repository.interface';

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'User';
  const part = local.split(/[._-]/)[0] ?? local;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export class ListTeamsUseCase {
  constructor(
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository
  ) {}

  async execute() {
    const teams = await this.teamRepo.findAll();

    return Promise.all(
      teams.map(async (team) => {
        let teamLeadName: string | null = null;
        let teamLeadEmail: string | null = null;

        if (team.teamLeadId) {
          const lead = await this.userRepo.findById(team.teamLeadId);
          if (lead) {
            teamLeadEmail = lead.email;
            teamLeadName = displayNameFromEmail(lead.email);
          }
        }

        const members = await this.userRepo.findManyByTeamId(team.id!);
        const driverCount = members.filter((m) => m.role === UserRole.DRIVER).length;

        return {
          id: team.id,
          name: team.name,
          code: team.code,
          teamLeadId: team.teamLeadId,
          teamLeadName,
          teamLeadEmail,
          memberCount: members.length,
          driverCount,
          createdBy: team.createdBy,
          createdAt: team.createdAt,
        };
      })
    );
  }
}
