import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import {
  PayrollBill,
  PayrollStatus,
} from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import { PayrollSettingsRepository } from '../../infrastructure/repositories/payrollSettings.repository';
import { PayrollRateOverrideRepository } from '../../infrastructure/repositories/payrollRateOverride.repository';
import { PayrollRouteAdjustmentRepository } from '../../infrastructure/repositories/payrollRouteAdjustment.repository';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { buildPayrollRateContext } from '../services/payrollRatesContext.service';
import { PayrollAuditService } from '../services/payrollAudit.service';
import {
  buildPayrollLineItems,
  payrollTotalsFromLineItems,
} from '../utils/buildPayrollLineItems';
import {
  applyDriverAdjustments,
  driverAdjustmentsRollup,
  type DriverLineAdjustmentInput,
} from '../utils/payrollBillRollups';
import {
  loadUnbilledCompletedRoutesForTeam,
  loadUnbilledCompletedRoutesForTeamInPeriod,
  parsePayrollPeriodInput,
  periodBoundsFromRoutes,
} from '../utils/unbilledPayrollRoutes';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { formatScheduleDate } from '../../../schedules/application/utils/scheduleDate';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

interface Actor {
  id: string;
  role: UserRole | null;
}

export interface GeneratePayrollInput {
  teamId: string;
  periodStart?: string;
  periodEnd?: string;
  /** When set, bill only these completed unbilled routes. */
  routeIds?: string[];
  /** Per-driver bonus, deduction, overtime applied when the bill is created. */
  adjustments?: DriverLineAdjustmentInput[];
}

export class GeneratePayrollBillUseCase {
  constructor(
    private payrollRepo: IPayrollRepository,
    private routeRepo: IRouteRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository,
    private settingsRepo: PayrollSettingsRepository,
    private overrideRepo: PayrollRateOverrideRepository,
    private scheduleRepo: ScheduleRepository,
    private adjustmentRepo: PayrollRouteAdjustmentRepository,
    private audit: PayrollAuditService,
    private notifications: NotificationService
  ) {}

  async execute(actor: Actor, input: GeneratePayrollInput): Promise<PayrollBill> {
    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('Only admin or dispatch manager can generate payroll bills.', 403);
    }

    const teamId = input.teamId?.trim();
    if (!teamId) throw new AppError('teamId is required.', 400);

    const team = await this.teamRepo.findById(teamId);
    if (!team) throw new AppError('Team not found.', 404);

    const routeIds = (input.routeIds ?? []).map((id) => id.trim()).filter(Boolean);
    const isRouteScoped = routeIds.length > 0;
    const hasPeriod = Boolean(input.periodStart?.trim() && input.periodEnd?.trim());

    if (!isRouteScoped) {
      const openBill = await this.payrollRepo.findOpenBillByTeam(teamId);
      if (openBill) {
        throw new AppError(
          `${team.name} already has an open payroll bill (${openBill.status}). Finish or pay it before creating another.`,
          409
        );
      }
    }

    let routes;
    let periodStart: Date;
    let periodEnd: Date;

    if (isRouteScoped) {
      const billedIds = new Set(await this.payrollRepo.collectAllBilledRouteIds());
      routes = [];
      for (const routeId of routeIds) {
        if (billedIds.has(routeId)) {
          const existing = await this.payrollRepo.findBillContainingRoute(routeId);
          throw new AppError(
            existing
              ? `This route is already on payroll bill ${existing.status}.`
              : 'This route is already billed.',
            409
          );
        }
        const route = await this.routeRepo.findById(routeId);
        if (!route) throw new AppError(`Route ${routeId} not found.`, 404);
        if (route.teamId !== teamId) {
          throw new AppError('Route does not belong to this team.', 400);
        }
        if (route.status !== RouteStatus.COMPLETED) {
          throw new AppError('Only completed routes can be billed.', 400);
        }
        if (!route.driverId) {
          throw new AppError('Route must have an assigned driver to bill.', 400);
        }
        routes.push(route);
      }
      if (hasPeriod) {
        ({ periodStart, periodEnd } = parsePayrollPeriodInput(
          input.periodStart,
          input.periodEnd
        ));
      } else {
        ({ periodStart, periodEnd } = periodBoundsFromRoutes(routes));
      }
    } else if (hasPeriod) {
      ({ periodStart, periodEnd } = parsePayrollPeriodInput(
        input.periodStart,
        input.periodEnd
      ));
      routes = await loadUnbilledCompletedRoutesForTeamInPeriod(
        this.routeRepo,
        this.payrollRepo,
        teamId,
        periodStart,
        periodEnd
      );
    } else {
      routes = await loadUnbilledCompletedRoutesForTeam(
        this.routeRepo,
        this.payrollRepo,
        teamId
      );
      ({ periodStart, periodEnd } = periodBoundsFromRoutes(routes));
    }

    if (routes.length === 0) {
      throw new AppError(
        isRouteScoped
          ? 'No billable routes in this request.'
          : 'No unbilled completed routes for this team in the selected period.',
        400
      );
    }

    const members = await this.userRepo.findManyByTeamId(teamId);
    const nameById = new Map<string, string>();
    members.forEach((m) => {
      if (m.id) nameById.set(m.id, m.fullName?.trim() || m.email);
    });
    if (team.teamLeadId && !nameById.has(team.teamLeadId)) {
      const lead = await this.userRepo.findById(team.teamLeadId);
      if (lead?.id) {
        nameById.set(lead.id, lead.fullName?.trim() || lead.email);
      }
    }

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
    const builtLineItems = buildPayrollLineItems(routes, nameById, rateContext, adjustments);
    const routeTotals = payrollTotalsFromLineItems(builtLineItems);
    const lineItems = applyDriverAdjustments(builtLineItems, input.adjustments ?? []);
    const driverRollups = driverAdjustmentsRollup(lineItems);
    const totalAmount = lineItems.reduce((sum, line) => sum + line.total, 0);

    const creator = await this.userRepo.findById(actor.id);
    const bill = new PayrollBill({
      teamId,
      teamName: team.name,
      teamNumber: team.teamNumber,
      periodStart,
      periodEnd,
      status: PayrollStatus.DRAFT,
      standardRate: settings.smallRouteRate,
      lineItems,
      totalAmount,
      subtotal: routeTotals.subtotal,
      adjustmentsTotal: routeTotals.adjustmentsTotal,
      bonusesTotal: driverRollups.bonusesTotal,
      deductionsTotal: driverRollups.deductionsTotal,
      overtimeTotal: driverRollups.overtimeTotal,
      createdBy: actor.id,
      createdByName: creator?.fullName?.trim() || creator?.email || 'Dispatch',
    });

    const saved = await this.payrollRepo.save(bill);

    await this.audit.log({
      userId: actor.id,
      userName: creator?.fullName?.trim() || creator?.email || 'User',
      action: 'payroll_generated',
      entityType: 'PayrollBill',
      entityId: saved.id ?? null,
      newValue: {
        teamId,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        totalAmount,
        routeCount: routes.length,
        bonusesTotal: driverRollups.bonusesTotal,
        deductionsTotal: driverRollups.deductionsTotal,
        overtimeTotal: driverRollups.overtimeTotal,
      },
    });

    const opsUsers = await this.userRepo.findActiveByRoles([
      UserRole.ADMIN,
      UserRole.DISPATCH_MANAGER,
    ]);
    await this.notifications.notifyPayrollGenerated({
      recipientIds: opsUsers.map((u) => u.id!).filter(Boolean),
      teamId,
      teamName: team.name,
      billId: saved.id!,
      totalAmount,
      periodStart: formatScheduleDate(periodStart),
      periodEnd: formatScheduleDate(periodEnd),
    });

    return saved;
  }
}
