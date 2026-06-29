import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { CreateUserUseCase } from '../../application/use-cases/createUser.use-case';
import { ListUsersUseCase } from '../../application/use-cases/listUsers.use-case';
import { GetUserUseCase } from '../../application/use-cases/getUser.use-case';
import { UpdateUserUseCase } from '../../application/use-cases/updateUser.use-case';
import { DeleteUserUseCase } from '../../application/use-cases/deleteUser.use-case';

export class UsersController {
  constructor(
    private createUserUseCase: CreateUserUseCase,
    private listUsersUseCase: ListUsersUseCase,
    private getUserUseCase: GetUserUseCase,
    private updateUserUseCase: UpdateUserUseCase,
    private deleteUserUseCase: DeleteUserUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.role) return next(new AppError('Unauthorized', 401));
      const data = await this.createUserUseCase.execute(req.body, req.user.role, req.user.id);
      res.status(201).json({
        success: true,
        message: 'User created successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.listUsersUseCase.execute(
        req.query as Record<string, string>,
        req.user
      );
      res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.getUserUseCase.execute(String(req.params.userId));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.role) return next(new AppError('Unauthorized', 401));
      const data = await this.updateUserUseCase.execute(
        String(req.params.userId),
        req.body,
        req.user.role,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: 'User updated successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.deleteUserUseCase.execute(String(req.params.userId));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
