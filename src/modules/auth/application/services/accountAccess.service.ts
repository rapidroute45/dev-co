import { UserStatus } from '../../../../shared/constants/roles';
import { AppError } from '../../../../shared/errors/app-error';
import type { User } from '../../domain/entities/user.entity';

export function assertUserCanLogin(user: User): void {
  if (user.status === UserStatus.SUSPENDED) {
    throw new AppError(
      'Your account has been suspended. Contact your administrator.',
      403
    );
  }

  if (user.status !== UserStatus.ACTIVE || user.role == null) {
    throw new AppError(
      'Your account is not active yet. Please wait for an administrator to approve your account before signing in.',
      403
    );
  }
}
