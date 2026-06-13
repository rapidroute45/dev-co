import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import { PayrollSettingsRepository } from '../../infrastructure/repositories/payrollSettings.repository';
import { PayrollRateOverrideRepository } from '../../infrastructure/repositories/payrollRateOverride.repository';
import { PayrollRouteAdjustmentRepository } from '../../infrastructure/repositories/payrollRouteAdjustment.repository';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { buildPayrollRateContext } from '../services/payrollRatesContext.service';
import { buildPayrollLineItems } from '../utils/buildPayrollLineItems';
import { loadUnbilledCompletedRoutesForTeam } from '../utils/unbilledPayrollRoutes';
import { formatScheduleDate } from '../../../schedules/application/utils/scheduleDate';

const OPS_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.ACCOUNTANT,
];

export type PayrollPendingDriverSummary = {
  driverId: string;
  driverName: string;
  routeCount: number;
  pendingAmount: number;
  routes: {
    routeId: string;
    routeName: string | null;
    location: string | null;
    scheduleDate: string;
    completedAt: string | null;
    rate: number;
    routeCategory: string;
    defaultRate: number;
    originalAmount: number;
    hasAdjustment: boolean;
  }[];
};

export type PayrollPendingTeamSummary = {
  teamId: string;
  teamName: string;
  teamNumber: number;
  routeCount: number;
  driverCount: number;
  pendingAmount: number;
  activeBillId: string | null;
  activeBillStatus: PayrollStatus | null;
  drivers: PayrollPendingDriverSummary[];
};

export type PayrollPendingSummary = {
  standardRate: number;
  rates: {
    smallRouteRate: number;
    mediumRouteRate: number;
    fullRouteRate: number;
  };
  totalPendingAmount: number;
  totalRouteCount: number;
  teamCount: number;
  teams: PayrollPendingTeamSummary[];
};

interface Actor {
  role: UserRole | null;
  teamId?: string | null;
}

export class GetPayrollPendingSummaryUseCase {
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

  async execute(actor: Actor): Promise<PayrollPendingSummary> {
    const settings = await this.settingsRepo.getOrCreate();
    const rates = {
      smallRouteRate: settings.smallRouteRate,
      mediumRouteRate: settings.mediumRouteRate,
      fullRouteRate: settings.fullRouteRate,
    };

    if (actor.role === UserRole.TEAM_LEAD) {
      if (!actor.teamId) {
        return this.emptySummary(settings.smallRouteRate, rates);
      }
      const team = await this.teamRepo.findById(actor.teamId);
      if (!team) {
        return this.emptySummary(settings.smallRouteRate, rates);
      }
      const summaries = await Promise.all([
        this.buildTeamSummary(team.id!, team.name, team.teamNumber, settings),
      ]);
      return this.rollup(summaries, settings.smallRouteRate, rates);
    }

    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('You do not have access to payroll pending summary.', 403);
    }

    const teams = await this.teamRepo.findAll();
    const summaries = await Promise.all(
      teams
        .filter((t) => Boolean(t.id))
        .map((t) => this.buildTeamSummary(t.id!, t.name, t.teamNumber, settings))
    );
    return this.rollup(summaries, settings.smallRouteRate, rates);
  }

  private emptySummary(
    standardRate: number,
    rates: PayrollPendingSummary['rates']
  ): PayrollPendingSummary {
    return {
      standardRate,
      rates,
      totalPendingAmount: 0,
      totalRouteCount: 0,
      teamCount: 0,
      teams: [],
    };
  }

  private rollup(
    summaries: PayrollPendingTeamSummary[],
    standardRate: number,
    rates: PayrollPendingSummary['rates']
  ): PayrollPendingSummary {
    const withPending = summaries.filter((t) => t.pendingAmount > 0 || t.activeBillId);
    const totalPendingAmount = summaries.reduce((s, t) => s + t.pendingAmount, 0);
    const totalRouteCount = summaries.reduce((s, t) => s + t.routeCount, 0);
    return {
      standardRate,
      rates,
      totalPendingAmount,
      totalRouteCount,
      teamCount: withPending.length,
      teams: summaries.sort((a, b) => b.pendingAmount - a.pendingAmount),
    };
  }

  private async buildTeamSummary(
    teamId: string,
    teamName: string,
    teamNumber: number,
    settings: Awaited<ReturnType<PayrollSettingsRepository['getOrCreate']>>
  ): Promise<PayrollPendingTeamSummary> {
    const openBill = await this.payrollRepo.findOpenBillByTeam(teamId);
    const routes = await loadUnbilledCompletedRoutesForTeam(
      this.routeRepo,
      this.payrollRepo,
      teamId
    );

    const members = await this.userRepo.findManyByTeamId(teamId);
    const nameById = new Map<string, string>();
    members.forEach((m) => {
      if (m.id) nameById.set(m.id, m.fullName?.trim() || m.email);
    });

    const rateContext = await buildPayrollRateContext(
      routes,
      this.settingsRepo,
      this.overrideRepo,
      this.scheduleRepo
    );
    const adjustments = await this.adjustmentRepo.findByRouteIds(
      routes.map((r) => r.id!).filter(Boolean)
    );
    const lineItems = buildPayrollLineItems(routes, nameById, rateContext, adjustments);
    const pendingAmount = lineItems.reduce((sum, line) => sum + line.total, 0);
    const routeCount = lineItems.reduce((sum, line) => sum + line.routeCount, 0);

    const drivers: PayrollPendingDriverSummary[] = lineItems.map((line) => ({
      driverId: line.driverId,
      driverName: line.driverName,
      routeCount: line.routeCount,
      pendingAmount: line.total,
      routes: line.routes.map((r) => ({
        routeId: r.routeId,
        routeName: r.routeName,
        location: r.location,
        scheduleDate: formatScheduleDate(r.scheduleDate),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        rate: r.rate,
        routeCategory: r.routeCategory,
        defaultRate: r.defaultRate,
        originalAmount: r.originalAmount,
        hasAdjustment: r.hasAdjustment ?? false,
      })),
    }));

    return {
      teamId,
      teamName,
      teamNumber,
      routeCount,
      driverCount: drivers.length,
      pendingAmount,
      activeBillId: openBill?.id ?? null,
      activeBillStatus: openBill?.status ?? null,
      drivers,
    };
  }
}
