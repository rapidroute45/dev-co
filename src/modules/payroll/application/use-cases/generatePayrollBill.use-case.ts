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
import { STANDARD_ROUTE_RATE } from '../payroll.constants';
import { buildPayrollLineItems } from '../utils/buildPayrollLineItems';
import {
  loadUnbilledCompletedRoutesForTeam,
  periodBoundsFromRoutes,
} from '../utils/unbilledPayrollRoutes';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER];

interface Actor {
  id: string;
  role: UserRole | null;
}

export interface GeneratePayrollInput {
  teamId: string;
  /** When set, bill only these completed unbilled routes (e.g. one route = $100). */
  routeIds?: string[];
}

export class GeneratePayrollBillUseCase {
  constructor(
    private payrollRepo: IPayrollRepository,
    private routeRepo: IRouteRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository
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
    } else {
      routes = await loadUnbilledCompletedRoutesForTeam(
        this.routeRepo,
        this.payrollRepo,
        teamId
      );
    }

    if (routes.length === 0) {
      throw new AppError(
        isRouteScoped
          ? 'No billable routes in this request.'
          : 'No unbilled completed routes for this team. Pending balance is $0.',
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

    const creator = await this.userRepo.findById(actor.id);
    const lineItems = buildPayrollLineItems(routes, nameById);
    const totalAmount = lineItems.reduce((sum, line) => sum + line.total, 0);
    const { periodStart, periodEnd } = periodBoundsFromRoutes(routes);

    const bill = new PayrollBill({
      teamId,
      teamName: team.name,
      teamNumber: team.teamNumber,
      periodStart,
      periodEnd,
      status: PayrollStatus.DRAFT,
      standardRate: STANDARD_ROUTE_RATE,
      lineItems,
      totalAmount,
      createdBy: actor.id,
      createdByName: creator?.fullName?.trim() || creator?.email || 'Dispatch',
    });

    return this.payrollRepo.save(bill);
  }
}
