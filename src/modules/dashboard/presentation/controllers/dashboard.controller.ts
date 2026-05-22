import { Request, Response, NextFunction } from 'express';
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
}
