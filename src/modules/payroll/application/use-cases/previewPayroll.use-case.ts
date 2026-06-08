import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import { PayrollSettingsRepository } from '../../infrastructure/repositories/payrollSettings.repository';
import { PayrollRateOverrideRepository } from '../../infrastructure/repositories/payrollRateOverride.repository';
import { PayrollRouteAdjustmentRepository } from '../../infrastructure/repositories/payrollRouteAdjustment.repository';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { buildPayrollRateContext } from '../services/payrollRatesContext.service';
import {
  buildPayrollLineItems,
  payrollTotalsFromLineItems,
} from '../utils/buildPayrollLineItems';
import {
  loadUnbilledCompletedRoutesForTeamInPeriod,
  parsePayrollPeriodInput,
} from '../utils/unbilledPayrollRoutes';
import { formatScheduleDate } from '../../../schedules/application/utils/scheduleDate';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER, UserRole.ACCOUNTANT];

export class PreviewPayrollUseCase {
  constructor(
    private payrollRepo: IPayrollRepository,
    private routeRepo: IRouteRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository,
    private settingsRepo: PayrollSettingsRepository,
    private overrideRepo: PayrollRateOverrideRepository,
    private scheduleRepo: ScheduleRepository,
    private adjustmentRepo: PayrollRouteAdjustmentRepository
  ) {}

  async execute(
    actor: { role: UserRole | null; teamId?: string | null },
    query: { teamId?: string; periodStart?: string; periodEnd?: string }
  ) {
    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('You do not have access to payroll preview.', 403);
    }

    const teamId = query.teamId?.trim();
    if (!teamId) throw new AppError('teamId is required.', 400);

    const team = await this.teamRepo.findById(teamId);
    if (!team) throw new AppError('Team not found.', 404);

    let periodStart: Date;
    let periodEnd: Date;
    try {
      ({ periodStart, periodEnd } = parsePayrollPeriodInput(
        query.periodStart,
        query.periodEnd
      ));
    } catch (e) {
      throw new AppError((e as Error).message, 400);
    }

    const routes = await loadUnbilledCompletedRoutesForTeamInPeriod(
      this.routeRepo,
      this.payrollRepo,
      teamId,
      periodStart,
      periodEnd
    );

    const members = await this.userRepo.findManyByTeamId(teamId);
    const nameById = new Map<string, string>();
    members.forEach((m) => {
      if (m.id) nameById.set(m.id, m.fullName?.trim() || m.email);
    });

    const [settings, rateContext, adjustments] = await Promise.all([
      this.settingsRepo.getOrCreate(),
      buildPayrollRateContext(
        routes,
        this.settingsRepo,
        this.overrideRepo,
        this.scheduleRepo
      ),
      this.adjustmentRepo.findByRouteIds(routes.map((r) => r.id!).filter(Boolean)),
    ]);
    const lineItems = buildPayrollLineItems(routes, nameById, rateContext, adjustments);
    const totals = payrollTotalsFromLineItems(lineItems);

    return {
      teamId,
      teamName: team.name,
      teamNumber: team.teamNumber,
      periodStart: formatScheduleDate(periodStart),
      periodEnd: formatScheduleDate(periodEnd),
      routeCount: routes.length,
      driverCount: lineItems.length,
      rates: {
        smallRouteRate: settings.smallRouteRate,
        mediumRouteRate: settings.mediumRouteRate,
        fullRouteRate: settings.fullRouteRate,
      },
      subtotal: totals.subtotal,
      adjustmentsTotal: totals.adjustmentsTotal,
      totalAmount: totals.totalAmount,
      drivers: lineItems.map((line) => ({
        driverId: line.driverId,
        driverName: line.driverName,
        routeCount: line.routeCount,
        total: line.total,
        routes: line.routes.map((r) => ({
          routeId: r.routeId,
          routeName: r.routeName,
          location: r.location,
          scheduleDate: formatScheduleDate(r.scheduleDate),
          completedAt: r.completedAt ? r.completedAt.toISOString() : null,
          routeCategory: r.routeCategory,
          defaultRate: r.defaultRate,
          originalAmount: r.originalAmount,
          rate: r.rate,
          hasAdjustment: r.hasAdjustment ?? false,
          adjustmentReason: r.adjustmentReason ?? null,
        })),
      })),
    };
  }
}
