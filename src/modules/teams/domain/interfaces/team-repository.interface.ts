import { Team } from '../entities/team.entity';

export interface TeamUpdateData {
  name?: string;
  teamLeadId?: string | null;
}

export interface ITeamRepository {
  findById(id: string): Promise<Team | null>;
  findByCode(code: string): Promise<Team | null>;
  findAll(): Promise<Team[]>;
  countByCodePrefix(prefix: string): Promise<number>;
  save(team: Team): Promise<Team>;
  update(teamId: string, data: TeamUpdateData): Promise<Team | null>;
  setTeamLead(teamId: string, userId: string | null): Promise<Team | null>;
  delete(teamId: string): Promise<boolean>;
}
