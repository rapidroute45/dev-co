import { Request, Response, NextFunction } from 'express';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { GetPendingUsersUseCase } from '../../application/use-cases/GetPendingUsers.use-case';
import { GetCurrentUserUseCase } from '../../application/use-cases/getCurrentUser.use-case';
import { AppError } from '../../../../shared/errors/app-error';
import { ENV } from '../../../../config/env';

export class AuthController {
  constructor(
    private registerUseCase: RegisterUseCase,
    private loginUseCase: LoginUseCase,
    private getPendingUsersUseCase: GetPendingUsersUseCase,
    private getCurrentUserUseCase: GetCurrentUserUseCase
  ) {}

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.registerUseCase.execute(req.body);
      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          id: result.id,
          email: result.email,
          fullName: result.fullName,
          status: result.status,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, user } = await this.loginUseCase.execute(req.body);

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: ENV.SESSION_MAX_AGE_MS,
      });

      res.status(200).json({
        success: true,
        message: 'Login successful.',
        token,
        user,
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const userProfile = await this.getCurrentUserUseCase.execute(req.user.id);
      res.status(200).json({ success: true, data: userProfile });
    } catch (error) {
      next(error);
    }
  };

  getPending = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const pendingUsers = await this.getPendingUsersUseCase.execute();
      res.status(200).json({ success: true, data: pendingUsers });
    } catch (error) {
      next(error);
    }
  };
}
