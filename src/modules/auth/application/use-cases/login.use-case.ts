import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'; // Make sure this is imported at the top
import { LoginDTO } from '../dto/login.dto';
import { IUserRepository } from '../../domain/interfaces/user-repository.interface';
import { AppError } from '../../../../shared/errors/app-error';
import { ENV } from '../../../../config/env';
import { UserRole } from '../../../../shared/constants/roles';
import { resolveUserAssignedCities } from '../../../users/application/mappers/userResponse.mapper';
import { assertUserCanLogin } from '../services/accountAccess.service';

export class LoginUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(dto: LoginDTO) {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new AppError('Invalid email or password credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password credentials', 401);
    }

    assertUserCanLogin(user);

    // Generate token payload utilizing internal Domain values
    const assignedCities = resolveUserAssignedCities(user);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        teamId: user.teamId ?? null,
        assignedCity: user.assignedCity ?? null,
        assignedCities,
      },
      ENV.JWT_SECRET,
      { expiresIn: ENV.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        status: user.status,
        teamId: user.teamId ?? null,
        assignedCity:
          user.role === UserRole.DISPATCH_TEAM
            ? assignedCities[0] ?? null
            : user.assignedCity ?? null,
        assignedCities,
      },
    };
  }
}