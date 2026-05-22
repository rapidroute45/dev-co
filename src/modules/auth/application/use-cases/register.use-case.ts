import bcrypt from 'bcryptjs';
import { RegisterDTO } from '../dto/register.dto';
import { IUserRepository } from '../../domain/interfaces/user-repository.interface';
import { User } from '../../domain/entities/user.entity';
import { UserStatus } from '../../../../shared/constants/roles';
import { AppError } from '../../../../shared/errors/app-error';

export class RegisterUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(dto: RegisterDTO) {
    const email = dto.email?.toLowerCase().trim();
    if (!email) throw new AppError('Email is required', 400);

    const existing = await this.userRepo.findByEmail(email);
    if (existing) throw new AppError('Email already in use', 400);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const newUser = new User({
      email,
      passwordHash,
      fullName: dto.fullName?.trim() || null,
      role: null,
      status: UserStatus.PENDING,
    });

    const saved = await this.userRepo.save(newUser);
    return {
      id: saved.id,
      email: saved.email,
      fullName: saved.fullName,
      status: saved.status,
      message:
        'Registration successful. Your account is pending role assignment by an administrator.',
    };
  }
}
