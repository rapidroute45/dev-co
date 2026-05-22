import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { UserRole } from '../../../../shared/constants/roles';
import { parseTimeToMinutes } from '../../../../shared/utils/parseTime';
import { parseScheduleDate } from '../utils/scheduleDate';
import { AppError } from '../../../../shared/errors/app-error';

const DRIVER_ROLES = [UserRole.DRIVER, UserRole.TEAM_DRIVER];

export class AvailabilityService {
  constructor(
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository,
    private routeRepo: IRouteRepository
  ) {}

  async getAvailableTeams(query: {
    date: string;
    arrivalTime: string;
    departureTime: string;
    excludeRouteId?: string;
  }) {
    if (!query.date || !query.arrivalTime || !query.departureTime) {
      throw new AppError('date, arrivalTime, and departureTime are required.', 400);
    }

    const scheduleDate = parseScheduleDate(query.date);
    const arrivalMinutes = parseTimeToMinutes(query.arrivalTime);
    const departureMinutes = parseTimeToMinutes(query.departureTime);

    if (departureMinutes <= arrivalMinutes) {
      throw new AppError('Departure time must be after arrival time.', 400);
    }

    const teams = await this.teamRepo.findAll();
    const availableTeams = [];

    for (const team of teams) {
      const drivers = await this.getTeamDrivers(team.id!);
      if (drivers.length === 0) continue;

      let availableCount = 0;
      for (const driver of drivers) {
        const overlaps = await this.routeRepo.findOverlappingForDriver({
          driverId: driver.id!,
          scheduleDate,
          arrivalMinutes,
          departureMinutes,
          excludeRouteId: query.excludeRouteId,
        });
        if (overlaps.length === 0) availableCount++;
      }

      if (availableCount > 0) {
        availableTeams.push({
          id: team.id,
          name: team.name,
          code: team.code,
          teamLeadId: team.teamLeadId,
          driverCount: drivers.length,
          availableDriverCount: availableCount,
        });
      }
    }

    return availableTeams;
  }

  async getAvailableDriversByTeam(
    teamId: string,
    query: {
      date: string;
      arrivalTime: string;
      departureTime: string;
      excludeRouteId?: string;
    }
  ) {
    const team = await this.teamRepo.findById(teamId);
    if (!team) throw new AppError('Team not found.', 404);

    const scheduleDate = parseScheduleDate(query.date);
    const arrivalMinutes = parseTimeToMinutes(query.arrivalTime);
    const departureMinutes = parseTimeToMinutes(query.departureTime);

    if (departureMinutes <= arrivalMinutes) {
      throw new AppError('Departure time must be after arrival time.', 400);
    }

    const drivers = await this.getTeamDrivers(teamId);
    const available = [];

    for (const driver of drivers) {
      const overlaps = await this.routeRepo.findOverlappingForDriver({
        driverId: driver.id!,
        scheduleDate,
        arrivalMinutes,
        departureMinutes,
        excludeRouteId: query.excludeRouteId,
      });
      if (overlaps.length === 0) {
        available.push({
          id: driver.id,
          email: driver.email,
          fullName: driver.fullName,
          role: driver.role,
        });
      }
    }

    return available;
  }

  private async getTeamDrivers(teamId: string) {
    const members = await this.userRepo.findManyByTeamId(teamId);
    return members.filter((m) => m.role && DRIVER_ROLES.includes(m.role));
  }
}
