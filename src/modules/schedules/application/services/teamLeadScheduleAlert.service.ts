import { ITeamLeadScheduleAlertRepository } from '../../domain/interfaces/team-lead-schedule-alert-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IStoreRepository } from '../../../stores/domain/interfaces/store-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { formatScheduleDate } from '../utils/scheduleDate';

export class TeamLeadScheduleAlertService {
  constructor(
    private alertRepo: ITeamLeadScheduleAlertRepository,
    private scheduleRepo: IScheduleRepository,
    private routeRepo: IRouteRepository,
    private storeRepo: IStoreRepository,
    private teamRepo: ITeamRepository
  ) {}

  /** Rebuild team-lead alerts after dispatch creates or updates routes on a schedule. */
  async syncForSchedule(scheduleId: string): Promise<void> {
    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule?.id) return;

    const store = await this.storeRepo.findById(schedule.storeId);
    const routes = await this.routeRepo.findManyByScheduleId(scheduleId);
    const routesByTeam = new Map<string, typeof routes>();

    for (const route of routes) {
      const teamId = route.teamId;
      if (!teamId) continue;
      const bucket = routesByTeam.get(teamId) ?? [];
      bucket.push(route);
      routesByTeam.set(teamId, bucket);
    }

    const activeTeamIds = new Set(routesByTeam.keys());
    const existingTeams = await Promise.all(
      [...activeTeamIds].map(async (teamId) => ({
        teamId,
        team: await this.teamRepo.findById(teamId),
      }))
    );

    for (const { teamId, team } of existingTeams) {
      const teamRoutes = routesByTeam.get(teamId) ?? [];
      if (!team?.teamLeadId || teamRoutes.length === 0) {
        await this.alertRepo.deleteByScheduleAndTeam(scheduleId, teamId);
        continue;
      }

      await this.alertRepo.upsertPending({
        scheduleId,
        teamId,
        teamLeadId: team.teamLeadId,
        scheduleDate: formatScheduleDate(schedule.date),
        city: schedule.city,
        state: schedule.state,
        storeName: store?.storeName ?? 'Store',
        routeCount: teamRoutes.length,
        assignedRouteCount: teamRoutes.filter((route) => Boolean(route.driverId)).length,
        updateType: 'schedule_updated',
        deletedRouteName: null,
      });
    }
  }

  /** Notify team lead that dispatch deleted a route on a schedule. */
  async notifyRouteDeleted(input: {
    scheduleId: string;
    teamId: string;
    routeName: string;
  }): Promise<void> {
    const schedule = await this.scheduleRepo.findById(input.scheduleId);
    if (!schedule?.id || !input.teamId) return;

    const team = await this.teamRepo.findById(input.teamId);
    if (!team?.teamLeadId) return;

    const store = await this.storeRepo.findById(schedule.storeId);
    const routes = await this.routeRepo.findManyByScheduleId(input.scheduleId);
    const teamRoutes = routes.filter((route) => route.teamId === input.teamId);

    await this.alertRepo.upsertPending({
      scheduleId: input.scheduleId,
      teamId: input.teamId,
      teamLeadId: team.teamLeadId,
      scheduleDate: formatScheduleDate(schedule.date),
      city: schedule.city,
      state: schedule.state,
      storeName: store?.storeName ?? 'Store',
      routeCount: teamRoutes.length,
      assignedRouteCount: teamRoutes.filter((route) => Boolean(route.driverId)).length,
      updateType: 'route_deleted',
      deletedRouteName: input.routeName.trim() || 'Route',
    });
  }

  listPending(teamLeadId: string) {
    return this.alertRepo.listPendingForTeamLead(teamLeadId);
  }

  acknowledgeSchedule(scheduleId: string, teamLeadId: string) {
    return this.alertRepo.acknowledge(scheduleId, teamLeadId);
  }

  acknowledgeRoutesForDate(teamLeadId: string, scheduleDate: string) {
    return this.alertRepo.acknowledgeForDate(teamLeadId, scheduleDate);
  }
}
