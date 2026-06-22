import jwt from 'jsonwebtoken';
import { ENV } from '../../../../config/env';
import { AppError } from '../../../../shared/errors/app-error';

export type OpsElevationScope = 'dispatch' | 'payroll';

export interface OpsElevationPayload {
  sub: string;
  scope: OpsElevationScope;
  type: 'ops-elevation';
}

const ELEVATION_EXPIRES_IN = '24h';

export function signOpsElevationToken(userId: string, scope: OpsElevationScope): string {
  return jwt.sign(
    { sub: userId, scope, type: 'ops-elevation' } satisfies OpsElevationPayload,
    ENV.JWT_SECRET,
    { expiresIn: ELEVATION_EXPIRES_IN }
  );
}

export function verifyOpsElevationToken(
  token: string,
  expectedScope: OpsElevationScope,
  userId: string
): void {
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as OpsElevationPayload;
    if (decoded.type !== 'ops-elevation') {
      throw new AppError('Invalid elevation token.', 403);
    }
    if (decoded.scope !== expectedScope) {
      throw new AppError('Elevation token scope mismatch.', 403);
    }
    if (decoded.sub !== userId) {
      throw new AppError('Elevation token user mismatch.', 403);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired elevation token.', 403);
  }
}
