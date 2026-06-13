import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { PayrollSettingsRepository } from '../../infrastructure/repositories/payrollSettings.repository';
import { PayrollRateOverrideRepository } from '../../infrastructure/repositories/payrollRateOverride.repository';
import { PayrollRouteAdjustmentRepository } from '../../infrastructure/repositories/payrollRouteAdjustment.repository';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { PayrollAuditService } from '../services/payrollAudit.service';
import { resolveRoutePay } from '../services/payrollCalculation.service';
import {
  buildPayrollRateContext,
  resolvePayrollRatesForRoute,
} from '../services/payrollRatesContext.service';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

export class UpsertRoutePayAdjustmentUseCase {
  constructor(
    private routeRepo: IRouteRepository,
    private settingsRepo: PayrollSettingsRepository,
    private overrideRepo: PayrollRateOverrideRepository,
    private scheduleRepo: ScheduleRepository,
    private adjustmentRepo: PayrollRouteAdjustmentRepository,
    private audit: PayrollAuditService,
    private userRepo: IUserRepository
  ) {}

  async execute(
    actor: { id: string; role: UserRole | null },
    routeId: string,
    body: { adjustedAmount?: unknown; reason?: string }
  ) {
    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('Only admin or dispatch manager can adjust route pay.', 403);
    }

    const route = await this.routeRepo.findById(routeId);
    if (!route) throw new AppError('Route not found.', 404);
    if (route.status !== RouteStatus.COMPLETED) {
      throw new AppError('Only completed routes can have pay adjustments.', 400);
    }
    if (!route.driverId) throw new AppError('Route has no assigned driver.', 400);

    const adjustedAmount = Number(body.adjustedAmount);
    if (!Number.isFinite(adjustedAmount) || adjustedAmount <= 0) {
      throw new AppError('adjustedAmount must be a positive number.', 400);
    }
    const reason = body.reason?.trim() || null;

    const rateContext = await buildPayrollRateContext(
      [route],
      this.settingsRepo,
      this.overrideRepo,
      this.scheduleRepo
    );
    const rates = resolvePayrollRatesForRoute(rateContext, route);
    const before = await this.adjustmentRepo.findByRouteId(routeId);
    const baseline = resolveRoutePay(route, rates, before);
    const originalAmount = before?.originalAmount ?? baseline.originalAmount;

    const saved = await this.adjustmentRepo.upsert({
      routeId,
      driverId: route.driverId,
      teamId: route.teamId,
      originalAmount,
      adjustedAmount,
      reason,
      adjustedBy: actor.id,
    });

    const user = await this.userRepo.findById(actor.id);
    await this.audit.log({
      userId: actor.id,
      userName: user?.fullName?.trim() || user?.email || 'User',
      action: 'route_pay_adjusted',
      entityType: 'Route',
      entityId: routeId,
      oldValue: before
        ? { originalAmount: before.originalAmount, adjustedAmount: before.adjustedAmount }
        : { originalAmount, adjustedAmount: baseline.rate },
      newValue: {
        originalAmount: saved.originalAmount,
        adjustedAmount: saved.adjustedAmount,
        reason: saved.reason,
      },
    });

    return {
      routeId: saved.routeId,
      driverId: saved.driverId,
      originalAmount: saved.originalAmount,
      adjustedAmount: saved.adjustedAmount,
      reason: saved.reason,
      adjustedAt: saved.adjustedAt.toISOString(),
    };
  }
}
