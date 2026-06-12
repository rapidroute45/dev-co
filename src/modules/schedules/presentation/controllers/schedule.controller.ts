import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { CreateScheduleUseCase } from '../../application/use-cases/createSchedule.use-case';
import { ListSchedulesUseCase } from '../../application/use-cases/listSchedules.use-case';
import { GetScheduleUseCase } from '../../application/use-cases/getSchedule.use-case';
import { UpdateScheduleUseCase } from '../../application/use-cases/updateSchedule.use-case';
import { DeleteScheduleUseCase } from '../../application/use-cases/deleteSchedule.use-case';
import { ListTeamLeadScheduleAlertsUseCase } from '../../application/use-cases/listTeamLeadScheduleAlerts.use-case';
import { AcknowledgeTeamLeadScheduleAlertUseCase } from '../../application/use-cases/acknowledgeTeamLeadScheduleAlert.use-case';

export class ScheduleController {
  constructor(
    private createScheduleUseCase: CreateScheduleUseCase,
    private listSchedulesUseCase: ListSchedulesUseCase,
    private getScheduleUseCase: GetScheduleUseCase,
    private updateScheduleUseCase: UpdateScheduleUseCase,
    private deleteScheduleUseCase: DeleteScheduleUseCase,
    private listTeamLeadScheduleAlertsUseCase: ListTeamLeadScheduleAlertsUseCase,
    private acknowledgeTeamLeadScheduleAlertUseCase: AcknowledgeTeamLeadScheduleAlertUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.createScheduleUseCase.execute(req.body, req.user.id, req.user);
      res.status(201).json({
        success: true,
        message: 'Schedule created successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  listTeamLeadAlerts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.listTeamLeadScheduleAlertsUseCase.execute(req.user);
      res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      next(error);
    }
  };

  dismissTeamLeadAlert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.acknowledgeTeamLeadScheduleAlertUseCase.execute(
        String(req.params.scheduleId),
        req.user
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.listSchedulesUseCase.execute(
        req.query as Record<string, string>,
        req.user
      );
      res.status(200).json({
        success: true,
        data: result.items,
        count: result.items.length,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.getScheduleUseCase.execute(
        String(req.params.id),
        req.user
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.updateScheduleUseCase.execute(
        String(req.params.id),
        req.body,
        req.user
      );
      res.status(200).json({
        success: true,
        message: 'Schedule updated successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.deleteScheduleUseCase.execute(
        String(req.params.id),
        req.user
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
