import { Request, Response, NextFunction } from 'express';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { GetPendingUsersUseCase } from '../../application/use-cases/GetPendingUsers.use-case';
import { GetCurrentUserUseCase } from '../../application/use-cases/getCurrentUser.use-case';
import { UpdateProfileUseCase } from '../../application/use-cases/updateProfile.use-case';
import { ChangePasswordUseCase } from '../../application/use-cases/changePassword.use-case';
import { VerifyOpsElevationPinUseCase } from '../../application/use-cases/verifyOpsElevationPin.use-case';
import { AppError } from '../../../../shared/errors/app-error';
import { ENV } from '../../../../config/env';

export class AuthController {
  constructor(
    private registerUseCase: RegisterUseCase,
    private loginUseCase: LoginUseCase,
    private getPendingUsersUseCase: GetPendingUsersUseCase,
    private getCurrentUserUseCase: GetCurrentUserUseCase,
    private updateProfileUseCase: UpdateProfileUseCase,
    private changePasswordUseCase: ChangePasswordUseCase,
    private verifyOpsElevationPinUseCase: VerifyOpsElevationPinUseCase
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
          phone: result.phone,
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

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { fullName, phone } = req.body as { fullName?: string; phone?: string };
      const userProfile = await this.updateProfileUseCase.execute(req.user.id, {
        fullName,
        phone,
      });
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        data: userProfile,
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
      };
      const result = await this.changePasswordUseCase.execute(req.user.id, {
        currentPassword: currentPassword ?? '',
        newPassword: newPassword ?? '',
      });
      res.status(200).json({ success: true, message: result.message });
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

  verifyOpsElevation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { scope, pin } = req.body as { scope?: string; pin?: string };
      const result = await this.verifyOpsElevationPinUseCase.execute(req.user.id, {
        scope: scope as 'dispatch' | 'payroll',
        pin: pin ?? '',
      });
      res.status(200).json({
        success: true,
        message: 'Elevation verified.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
