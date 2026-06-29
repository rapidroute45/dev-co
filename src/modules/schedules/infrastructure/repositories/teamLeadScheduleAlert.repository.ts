import {
  ITeamLeadScheduleAlertRepository,
  TeamLeadScheduleAlertRecord,
  UpsertTeamLeadScheduleAlertInput,
} from '../../domain/interfaces/team-lead-schedule-alert-repository.interface';
import {
  TeamLeadScheduleAlertDocument,
  TeamLeadScheduleAlertModel,
} from '../models/teamLeadScheduleAlert.model';

function mapDoc(doc: TeamLeadScheduleAlertDocument): TeamLeadScheduleAlertRecord {
  return {
    id: doc._id.toString(),
    scheduleId: doc.scheduleId.toString(),
    teamId: doc.teamId.toString(),
    teamLeadId: doc.teamLeadId.toString(),
    scheduleDate: doc.scheduleDate,
    city: doc.city,
    state: doc.state,
    storeName: doc.storeName,
    routeCount: doc.routeCount,
    assignedRouteCount: doc.assignedRouteCount,
    updateType: doc.updateType ?? 'schedule_updated',
    deletedRouteName: doc.deletedRouteName ?? null,
    seenAt: doc.seenAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class TeamLeadScheduleAlertRepository implements ITeamLeadScheduleAlertRepository {
  async upsertPending(input: UpsertTeamLeadScheduleAlertInput): Promise<TeamLeadScheduleAlertRecord> {
    const doc = await TeamLeadScheduleAlertModel.findOneAndUpdate(
      { scheduleId: input.scheduleId, teamId: input.teamId },
      {
        $set: {
          teamLeadId: input.teamLeadId,
          scheduleDate: input.scheduleDate,
          city: input.city,
          state: input.state,
          storeName: input.storeName,
          routeCount: input.routeCount,
          assignedRouteCount: input.assignedRouteCount,
          updateType: input.updateType ?? 'schedule_updated',
          deletedRouteName: input.deletedRouteName ?? null,
          seenAt: null,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    if (!doc) throw new Error('Failed to save team lead schedule alert');
    return mapDoc(doc);
  }

  async deleteByScheduleAndTeam(scheduleId: string, teamId: string): Promise<void> {
    await TeamLeadScheduleAlertModel.deleteOne({ scheduleId, teamId });
  }

  async deleteByScheduleId(scheduleId: string): Promise<void> {
    await TeamLeadScheduleAlertModel.deleteMany({ scheduleId });
  }

  async listPendingForTeamLead(teamLeadId: string): Promise<TeamLeadScheduleAlertRecord[]> {
    const docs = await TeamLeadScheduleAlertModel.find({
      teamLeadId,
      seenAt: null,
    }).sort({ scheduleDate: 1, updatedAt: -1 });
    return docs.map((doc) => mapDoc(doc));
  }

  async acknowledge(scheduleId: string, teamLeadId: string): Promise<boolean> {
    const result = await TeamLeadScheduleAlertModel.updateOne(
      { scheduleId, teamLeadId, seenAt: null },
      { $set: { seenAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  async acknowledgeForDate(teamLeadId: string, scheduleDate: string): Promise<number> {
    const result = await TeamLeadScheduleAlertModel.updateMany(
      { teamLeadId, scheduleDate, seenAt: null },
      { $set: { seenAt: new Date() } }
    );
    return result.modifiedCount;
  }
}
