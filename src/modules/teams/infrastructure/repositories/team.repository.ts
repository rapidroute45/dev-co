import { Team } from '../../domain/entities/team.entity';
import { ITeamRepository } from '../../domain/interfaces/team-repository.interface';
import { TeamModel } from '../models/team.model';

function mapDoc(doc: {
  _id: { toString(): string };
  name: string;
  code: string;
  teamNumber?: number | null;
  teamLeadId?: { toString(): string } | null;
  createdBy: { toString(): string };
  createdAt?: Date;
  updatedAt?: Date;
}): Team {
  return new Team({
    id: doc._id.toString(),
    name: doc.name,
    code: doc.code,
    teamNumber: doc.teamNumber ?? 0,
    teamLeadId: doc.teamLeadId?.toString() ?? null,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class TeamRepository implements ITeamRepository {
  async findById(id: string): Promise<Team | null> {
    const doc = await TeamModel.findById(id);
    return doc ? mapDoc(doc) : null;
  }

  async findByCode(code: string): Promise<Team | null> {
    const doc = await TeamModel.findOne({ code: code.toUpperCase().trim() });
    return doc ? mapDoc(doc) : null;
  }

  async findAll(): Promise<Team[]> {
    const docs = await TeamModel.find().sort({ createdAt: -1 });
    return docs.map(mapDoc);
  }

  async countByCodePrefix(prefix: string): Promise<number> {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return TeamModel.countDocuments({ code: new RegExp(`^${escaped}-`, 'i') });
  }

  async getMaxTeamNumber(): Promise<number> {
    const highest = await TeamModel.findOne({ teamNumber: { $ne: null } })
      .sort({ teamNumber: -1 })
      .select('teamNumber')
      .lean();
    return highest?.teamNumber ?? 0;
  }

  async save(team: Team): Promise<Team> {
    const created = await TeamModel.create({
      name: team.name,
      code: team.code,
      teamNumber: team.teamNumber,
      teamLeadId: team.teamLeadId ?? null,
      createdBy: team.createdBy,
    });
    return mapDoc(created);
  }

  async update(
    teamId: string,
    data: { name?: string; teamLeadId?: string | null }
  ): Promise<Team | null> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.teamLeadId !== undefined) patch.teamLeadId = data.teamLeadId;

    const doc = await TeamModel.findByIdAndUpdate(teamId, patch, {
      returnDocument: 'after',
    });
    return doc ? mapDoc(doc) : null;
  }

  async setTeamLead(teamId: string, userId: string | null): Promise<Team | null> {
    return this.update(teamId, { teamLeadId: userId });
  }

  async delete(teamId: string): Promise<boolean> {
    const result = await TeamModel.findByIdAndDelete(teamId);
    return result != null;
  }
}
