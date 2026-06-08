import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env';
import { AppError } from '../errors/app-error';
import { UserStatus, UserRole } from '../constants/roles';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole | null;
  status: UserStatus;
  teamId?: string | null;
  assignedCity?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  return authHeader.slice(7).trim() || undefined;
}

type RequireAuthOptions = {
  /** Allow pending accounts (e.g. GET /me for the waiting screen). */
  allowPending?: boolean;
};

export const requireAuth = (options: RequireAuthOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Web: httpOnly cookie. Mobile: Authorization Bearer header.
    const token = req.cookies.token ?? extractBearerToken(req.headers.authorization);

    if (!token) {
      return next(new AppError('Authentication token missing. Please log in.', 401));
    }

    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as AuthenticatedUser;

      if (!options.allowPending && decoded.status === UserStatus.PENDING) {
        return next(new AppError('Access Denied: Your account is pending manager approval.', 403));
      }

      if (decoded.status === UserStatus.SUSPENDED) {
        return next(new AppError('Access Denied: This account has been suspended.', 403));
      }

      req.user = decoded;
      next();
    } catch (error) {
      next(new AppError('Invalid or expired token', 401));
    }
  };
};