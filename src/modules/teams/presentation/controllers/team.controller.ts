import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { CreateTeamUseCase } from '../../application/use-cases/createTeam.use-case';
import { ListTeamsUseCase } from '../../application/use-cases/listTeams.use-case';
import { GetTeamDetailUseCase } from '../../application/use-cases/getTeamDetail.use-case';
import { UpdateTeamUseCase } from '../../application/use-cases/updateTeam.use-case';
import { DeleteTeamUseCase } from '../../application/use-cases/deleteTeam.use-case';

export class TeamController {
  constructor(
    private createTeamUseCase: CreateTeamUseCase,
    private listTeamsUseCase: ListTeamsUseCase,
    private getTeamDetailUseCase: GetTeamDetailUseCase,
    private updateTeamUseCase: UpdateTeamUseCase,
    private deleteTeamUseCase: DeleteTeamUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const team = await this.createTeamUseCase.execute(req.body, req.user.id);
      res.status(201).json({
        success: true,
        message: 'Team created successfully.',
        data: team,
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const teams = await this.listTeamsUseCase.execute();
      res.status(200).json({ success: true, data: teams, count: teams.length });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.getTeamDetailUseCase.execute(String(req.params.teamId));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.updateTeamUseCase.execute(String(req.params.teamId), req.body);
      res.status(200).json({
        success: true,
        message: 'Team updated successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.deleteTeamUseCase.execute(String(req.params.teamId));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
