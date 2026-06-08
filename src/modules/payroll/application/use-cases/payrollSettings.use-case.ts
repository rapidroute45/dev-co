import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { PayrollSettingsRepository } from '../../infrastructure/repositories/payrollSettings.repository';
import { PayrollAuditService } from '../services/payrollAudit.service';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

function assertOps(role: UserRole | null | undefined) {
  if (!role || !OPS_ROLES.includes(role)) {
    throw new AppError('Only admin or dispatch manager can manage payroll settings.', 403);
  }
}

function assertPositiveRate(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(`${label} must be a positive number.`, 400);
  }
  return n;
}

export class GetPayrollSettingsUseCase {
  constructor(private settingsRepo: PayrollSettingsRepository) {}

  async execute(role: UserRole | null | undefined) {
    assertOps(role);
    const settings = await this.settingsRepo.getOrCreate();
    return {
      scope: 'default' as const,
      smallRouteRate: settings.smallRouteRate,
      mediumRouteRate: settings.mediumRouteRate,
      fullRouteRate: settings.fullRouteRate,
      updatedAt: settings.updatedAt?.toISOString() ?? null,
    };
  }
}

export class UpdatePayrollSettingsUseCase {
  constructor(
    private settingsRepo: PayrollSettingsRepository,
    private audit: PayrollAuditService,
    private userRepo: IUserRepository
  ) {}

  async execute(
    actor: { id: string; role: UserRole | null },
    body: {
      smallRouteRate?: unknown;
      mediumRouteRate?: unknown;
      fullRouteRate?: unknown;
    }
  ) {
    assertOps(actor.role);
    const before = await this.settingsRepo.getOrCreate();
    const updated = await this.settingsRepo.update({
      smallRouteRate: assertPositiveRate(body.smallRouteRate, 'smallRouteRate'),
      mediumRouteRate: assertPositiveRate(body.mediumRouteRate, 'mediumRouteRate'),
      fullRouteRate: assertPositiveRate(body.fullRouteRate, 'fullRouteRate'),
      updatedBy: actor.id,
    });
    const user = await this.userRepo.findById(actor.id);
    await this.audit.log({
      userId: actor.id,
      userName: user?.fullName?.trim() || user?.email || 'User',
      action: 'payroll_settings_updated',
      entityType: 'PayrollSettings',
      entityId: updated.id ?? null,
      oldValue: {
        smallRouteRate: before.smallRouteRate,
        mediumRouteRate: before.mediumRouteRate,
        fullRouteRate: before.fullRouteRate,
      },
      newValue: {
        smallRouteRate: updated.smallRouteRate,
        mediumRouteRate: updated.mediumRouteRate,
        fullRouteRate: updated.fullRouteRate,
      },
    });
    return {
      scope: 'default' as const,
      smallRouteRate: updated.smallRouteRate,
      mediumRouteRate: updated.mediumRouteRate,
      fullRouteRate: updated.fullRouteRate,
      updatedAt: updated.updatedAt?.toISOString() ?? null,
    };
  }
}
