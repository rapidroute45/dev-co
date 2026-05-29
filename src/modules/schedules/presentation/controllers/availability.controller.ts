import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { AvailabilityService } from '../../application/services/availability.service';

export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  getTeams = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string>;
      const data = await this.availabilityService.getAvailableTeams({
        date: q.date,
        arrivalTime: q.arrivalTime,
        departureTime: q.departureTime,
        excludeRouteId: q.excludeRouteId,
      });
      res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      next(error);
    }
  };

  getDriversByTeam = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = String(req.params.teamId);
      // Team leads may only see drivers on their own team.
      if (req.user?.role === UserRole.TEAM_LEAD && req.user.teamId !== teamId) {
        throw new AppError('You can only view drivers on your own team.', 403);
      }
      const q = req.query as Record<string, string>;
      const data = await this.availabilityService.getAvailableDriversByTeam(
        teamId,
        {
          date: q.date,
          arrivalTime: q.arrivalTime,
          departureTime: q.departureTime,
          excludeRouteId: q.excludeRouteId,
        }
      );
      res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      next(error);
    }
  };
}
