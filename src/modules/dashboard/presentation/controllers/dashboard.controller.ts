import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { ManagerDashboardService } from '../../application/services/managerDashboard.service';

export class DashboardController {
  constructor(private dashboardService: ManagerDashboardService) {}

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.dashboardService.getStats(
        req.query as Record<string, string>
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  listAvailableDrivers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.dashboardService.listAvailableDrivers(
        req.query as Record<string, string>
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getTeamStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.user?.teamId;
      if (!teamId) {
        throw new AppError('No team is assigned to your account.', 400);
      }
      const data = await this.dashboardService.getTeamStats(
        teamId,
        req.query as Record<string, string>
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  listTeamAvailableDrivers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.user?.teamId;
      if (!teamId) {
        throw new AppError('No team is assigned to your account.', 400);
      }
      const data = await this.dashboardService.listTeamAvailableDrivers(
        teamId,
        req.query as Record<string, string>
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
