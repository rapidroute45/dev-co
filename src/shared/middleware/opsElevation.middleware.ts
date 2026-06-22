import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles';
import { AppError } from '../errors/app-error';
import {
  OpsElevationScope,
  verifyOpsElevationToken,
} from '../../modules/auth/application/services/opsElevation.service';

function extractElevationToken(req: Request): string | undefined {
  const header = req.headers['x-ops-elevation'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith('OpsElevation ')) {
    return auth.slice('OpsElevation '.length).trim() || undefined;
  }
  return undefined;
}

function roleRequiresDispatchElevation(role: UserRole | null | undefined): boolean {
  return role === UserRole.ADMIN;
}

function roleRequiresPayrollElevation(role: UserRole | null | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.DISPATCH_MANAGER;
}

/** Require ops elevation token for admin dispatch mutations and admin/dispatch-manager payroll mutations. */
export const requireOpsElevation = (scope: OpsElevationScope) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return next(new AppError('Unauthorized', 401));
    }

    const needsElevation =
      scope === 'dispatch'
        ? roleRequiresDispatchElevation(user.role)
        : roleRequiresPayrollElevation(user.role);

    if (!needsElevation) {
      return next();
    }

    const token = extractElevationToken(req);
    if (!token) {
      return next(
        new AppError('Ops elevation required. Enter the correct PIN to continue.', 403)
      );
    }

    try {
      verifyOpsElevationToken(token, scope, user.id);
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireDispatchElevation = requireOpsElevation('dispatch');
export const requirePayrollElevation = requireOpsElevation('payroll');
