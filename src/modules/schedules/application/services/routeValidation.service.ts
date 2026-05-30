import { AppError } from '../../../../shared/errors/app-error';
import { parseTimeToMinutes, formatMinutesToTime } from '../../../../shared/utils/parseTime';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { UserRole } from '../../../../shared/constants/roles';

export type ValidatedRouteTimes = {
  arrivalTime: string;
  departureTime: string;
  arrivalMinutes: number;
  departureMinutes: number;
};

export class RouteValidationService {
  constructor(
    private scheduleRepo: IScheduleRepository,
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository,
    private routeRepo: IRouteRepository
  ) {}

  parseAndValidateTimes(arrivalTime: string, departureTime: string): ValidatedRouteTimes {
    const arrivalMinutes = parseTimeToMinutes(arrivalTime);
    const departureMinutes = parseTimeToMinutes(departureTime);

    if (departureMinutes <= arrivalMinutes) {
      throw new AppError('Departure time must be after arrival time.', 400);
    }

    return {
      arrivalTime: formatMinutesToTime(arrivalMinutes),
      departureTime: formatMinutesToTime(departureMinutes),
      arrivalMinutes,
      departureMinutes,
    };
  }

  async assertScheduleExists(scheduleId: string) {
    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule) throw new AppError('Schedule not found.', 404);
    return schedule;
  }

  async assertTeamExists(teamId: string) {
    const team = await this.teamRepo.findById(teamId);
    if (!team) throw new AppError('Team not found.', 404);
    return team;
  }

  async assertDriverOnTeam(teamId: string, driverId: string) {
    const driver = await this.userRepo.findById(driverId);
    if (!driver) throw new AppError('Driver not found.', 404);

    if (driver.teamId !== teamId) {
      throw new AppError('Selected driver does not belong to the selected team.', 400);
    }

    // Team leads may be assigned to drive their own team's routes.
    const allowedRoles = [UserRole.DRIVER, UserRole.TEAM_DRIVER, UserRole.TEAM_LEAD];
    if (!driver.role || !allowedRoles.includes(driver.role)) {
      throw new AppError('Selected user is not a driver role.', 400);
    }

    return driver;
  }

  async assertDriverAvailable(params: {
    driverId: string;
    scheduleDate: Date;
    arrivalMinutes: number;
    departureMinutes: number;
    excludeRouteId?: string;
  }) {
    const overlaps = await this.routeRepo.findOverlappingForDriver(params);
    if (overlaps.length > 0) {
      throw new AppError(
        'Driver is already assigned to an overlapping route on this date.',
        409
      );
    }
  }
}
