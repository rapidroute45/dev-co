import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { parseScheduleDate, formatScheduleDate } from '../../../schedules/application/utils/scheduleDate';
import { resolveDisplayName } from '../../../../shared/utils/displayName';

const DRIVER_ROLES = [UserRole.DRIVER, UserRole.TEAM_DRIVER, UserRole.TEAM_LEAD];
export class ManagerDashboardService {
  constructor(
    private routeRepo: IRouteRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository
  ) {}

  private resolveDate(query: Record<string, string>): Date {
    const raw = query.date?.trim();
    if (!raw) {
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);
      return now;
    }
    return parseScheduleDate(raw);
  }

  async getStats(query: Record<string, string>) {
    const scheduleDate = this.resolveDate(query);
    const date = formatScheduleDate(scheduleDate);

    const [todayRoutes, completedRoutes, availableDrivers] = await Promise.all([
      this.routeRepo.countByScheduleDate(scheduleDate),
      this.routeRepo.countByScheduleDate(scheduleDate, RouteStatus.COMPLETED),
      this.countAvailableDrivers(scheduleDate),
    ]);

    return {
      date,
      todayRoutes,
      availableDrivers,
      completedRoutes,
    };
  }

  async listAvailableDrivers(query: Record<string, string>) {
    const scheduleDate = this.resolveDate(query);
    const date = formatScheduleDate(scheduleDate);
    const drivers = await this.getAvailableDriverUsers(scheduleDate);

    const data = await Promise.all(
      drivers.map(async (driver) => {
        const team = driver.teamId
          ? await this.teamRepo.findById(driver.teamId)
          : null;
        return {
          id: driver.id,
          email: driver.email,
          fullName: driver.fullName,
          displayName: resolveDisplayName(driver.fullName, driver.email),
          role: driver.role,
          teamId: driver.teamId,
          teamName: team?.name ?? null,
          teamCode: team?.code ?? null,
        };
      })
    );

    return { date, count: data.length, drivers: data };
  }

  async getTeamStats(teamId: string, query: Record<string, string>) {
    const scheduleDate = this.resolveDate(query);
    const date = formatScheduleDate(scheduleDate);
    const team = await this.teamRepo.findById(teamId);

    const [todayRoutes, completedRoutes, availableDrivers] = await Promise.all([
      this.routeRepo.countByTeamAndScheduleDate(teamId, scheduleDate),
      this.routeRepo.countByTeamAndScheduleDate(teamId, scheduleDate, RouteStatus.COMPLETED),
      this.countTeamAvailableDrivers(teamId, scheduleDate),
    ]);

    return {
      date,
      teamId,
      teamName: team?.name ?? null,
      teamCode: team?.code ?? null,
      todayRoutes,
      availableDrivers,
      completedRoutes,
    };
  }

  async listTeamAvailableDrivers(teamId: string, query: Record<string, string>) {
    const scheduleDate = this.resolveDate(query);
    const date = formatScheduleDate(scheduleDate);
    const team = await this.teamRepo.findById(teamId);
    const drivers = await this.getTeamAvailableDriverUsers(teamId, scheduleDate);

    const data = drivers.map((driver) => ({
      id: driver.id,
      email: driver.email,
      fullName: driver.fullName,
      displayName: resolveDisplayName(driver.fullName, driver.email),
      role: driver.role,
      teamId: driver.teamId,
      teamName: team?.name ?? null,
      teamCode: team?.code ?? null,
    }));

    return { date, count: data.length, drivers: data };
  }

  private async countAvailableDrivers(scheduleDate: Date): Promise<number> {
    const drivers = await this.getAvailableDriverUsers(scheduleDate);
    return drivers.length;
  }

  private async countTeamAvailableDrivers(
    teamId: string,
    scheduleDate: Date
  ): Promise<number> {
    const drivers = await this.getTeamAvailableDriverUsers(teamId, scheduleDate);
    return drivers.length;
  }

  private async getTeamAvailableDriverUsers(teamId: string, scheduleDate: Date) {
    const [teamMembers, busyDriverIds] = await Promise.all([
      this.userRepo.findManyByTeamId(teamId),
      this.routeRepo.findBusyDriverIdsOnDate(scheduleDate),
    ]);
    const busy = new Set(busyDriverIds);
    return teamMembers.filter(
      (member) =>
        member.id &&
        member.status === UserStatus.ACTIVE &&
        member.role != null &&
        DRIVER_ROLES.includes(member.role) &&
        !busy.has(member.id)
    );
  }

  private async getAvailableDriverUsers(scheduleDate: Date) {
    const [allDrivers, busyDriverIds] = await Promise.all([
      this.userRepo.findActiveDrivers(),
      this.routeRepo.findBusyDriverIdsOnDate(scheduleDate),
    ]);
    const busy = new Set(busyDriverIds);
    return allDrivers.filter((d) => d.id && !busy.has(d.id));
  }
}
