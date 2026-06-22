import { AppError } from '../../../../shared/errors/app-error';
import { AppSettingsRepository } from '../../infrastructure/repositories/appSettings.repository';
import {
  OpsElevationScope,
  signOpsElevationToken,
} from '../services/opsElevation.service';

export interface VerifyOpsElevationPinDTO {
  scope: OpsElevationScope;
  pin: string;
}

export class VerifyOpsElevationPinUseCase {
  constructor(private appSettingsRepo: AppSettingsRepository) {}

  async execute(userId: string, dto: VerifyOpsElevationPinDTO) {
    const scope = dto.scope;
    if (scope !== 'dispatch' && scope !== 'payroll') {
      throw new AppError('Invalid elevation scope.', 400);
    }

    const pin = dto.pin?.trim();
    if (!pin) {
      throw new AppError('PIN is required.', 400);
    }

    const settings = await this.appSettingsRepo.getOrCreate();
    const expectedPin =
      scope === 'dispatch'
        ? settings.dispatchElevationPin
        : settings.payrollElevationPin;

    if (pin !== expectedPin) {
      throw new AppError('Incorrect PIN.', 401);
    }

    const token = signOpsElevationToken(userId, scope);
    return { token, scope };
  }
}
