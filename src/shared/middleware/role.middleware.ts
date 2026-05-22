import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';
import { UserRole } from '../constants/roles';

export const requireRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('Access Denied: Insufficient permissions.', 403));
    }

    next();
  };
};