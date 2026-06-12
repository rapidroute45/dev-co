export type TeamLeadScheduleAlertRecord = {
  id?: string;
  scheduleId: string;
  teamId: string;
  teamLeadId: string;
  scheduleDate: string;
  city: string;
  state: string;
  storeName: string;
  routeCount: number;
  assignedRouteCount: number;
  updateType?: 'schedule_updated' | 'route_deleted';
  deletedRouteName?: string | null;
  seenAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpsertTeamLeadScheduleAlertInput = Omit<
  TeamLeadScheduleAlertRecord,
  'id' | 'seenAt' | 'createdAt' | 'updatedAt'
>;

export interface ITeamLeadScheduleAlertRepository {
  upsertPending(input: UpsertTeamLeadScheduleAlertInput): Promise<TeamLeadScheduleAlertRecord>;
  deleteByScheduleAndTeam(scheduleId: string, teamId: string): Promise<void>;
  listPendingForTeamLead(teamLeadId: string): Promise<TeamLeadScheduleAlertRecord[]>;
  acknowledge(scheduleId: string, teamLeadId: string): Promise<boolean>;
  acknowledgeForDate(teamLeadId: string, scheduleDate: string): Promise<number>;
}
