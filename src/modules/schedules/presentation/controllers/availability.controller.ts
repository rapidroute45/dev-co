import { Request, Response, NextFunction } from 'express';
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
      const q = req.query as Record<string, string>;
      const data = await this.availabilityService.getAvailableDriversByTeam(
        String(req.params.teamId),
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
