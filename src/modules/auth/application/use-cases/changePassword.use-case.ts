import bcrypt from 'bcryptjs';
import { IUserRepository } from '../../domain/interfaces/user-repository.interface';
import { AppError } from '../../../../shared/errors/app-error';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(userId: string, input: ChangePasswordInput) {
    const current = input.currentPassword?.trim();
    const next = input.newPassword?.trim();

    if (!current) {
      throw new AppError('Current password is required.', 400);
    }
    if (!next || next.length < 8) {
      throw new AppError('New password must be at least 8 characters.', 400);
    }
    if (current === next) {
      throw new AppError('New password must be different from the current password.', 400);
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User session invalid or user no longer exists.', 404);
    }

    const valid = await bcrypt.compare(current, user.passwordHash);
    if (!valid) {
      throw new AppError('Current password is incorrect.', 401);
    }

    const passwordHash = await bcrypt.hash(next, 10);
    const updated = await this.userRepo.update(userId, { passwordHash });
    if (!updated) {
      throw new AppError('Could not update password.', 500);
    }

    return { message: 'Password updated successfully.' };
  }
}
