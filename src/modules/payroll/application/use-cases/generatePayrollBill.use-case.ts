import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { IRouteRepository } from '../../../schedules/domain/interfaces/route-repository.interface';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { parseScheduleDate } from '../../../schedules/application/utils/scheduleDate';
import {
  PayrollBill,
  PayrollDriverLine,
  PayrollStatus,
} from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import { STANDARD_ROUTE_RATE } from '../payroll.constants';

interface Actor {
  id: string;
  role: UserRole | null;
  teamId?: string | null;
}

export interface GeneratePayrollInput {
  periodStart: string;
  periodEnd: string;
}

export class GeneratePayrollBillUseCase {
  constructor(
    private payrollRepo: IPayrollRepository,
    private routeRepo: IRouteRepository,
    private userRepo: IUserRepository,
    private teamRepo: ITeamRepository
  ) {}

  async execute(actor: Actor, input: GeneratePayrollInput): Promise<PayrollBill> {
    if (actor.role !== UserRole.TEAM_LEAD) {
      throw new AppError('Only team leads can generate payroll bills.', 403);
    }
    if (!actor.teamId) {
      throw new AppError('You are not assigned to a team.', 400);
    }

    const periodStart = parseScheduleDate(input.periodStart);
    const periodEnd = parseScheduleDate(input.periodEnd);
    if (periodEnd < periodStart) {
      throw new AppError('Period end must be on or after the start date.', 400);
    }

    const team = await this.teamRepo.findById(actor.teamId);
    if (!team) throw new AppError('Team not found.', 404);

    const existing = await this.payrollRepo.findByTeamAndPeriod(
      actor.teamId,
      periodStart,
      periodEnd
    );
    if (existing) {
      const statusLabel =
        existing.status === PayrollStatus.APPROVED
          ? 'approved'
          : existing.status === PayrollStatus.SUBMITTED
            ? 'submitted'
            : existing.status === PayrollStatus.REJECTED
              ? 'sent back'
              : 'draft';
      throw new AppError(
        `A payroll bill for this week already exists (${statusLabel}). Open it from the list instead of creating a new one.`,
        409
      );
    }

    const routes = await this.routeRepo.findCompletedByTeamInRange(
      actor.teamId,
      periodStart,
      periodEnd
    );

    if (routes.length === 0) {
      throw new AppError('No completed routes for this team in the selected period.', 400);
    }

    const members = await this.userRepo.findManyByTeamId(actor.teamId);
    const nameById = new Map<string, string>();
    members.forEach((m) => {
      if (m.id) nameById.set(m.id, m.fullName?.trim() || m.email);
    });

    const grouped = new Map<string, PayrollDriverLine>();
    for (const route of routes) {
      const driverId = route.driverId;
      if (!driverId || !route.id) continue;

      let line = grouped.get(driverId);
      if (!line) {
        line = {
          driverId,
          driverName: nameById.get(driverId) ?? 'Driver',
          routeCount: 0,
          basePay: 0,
          bonus: 0,
          deduction: 0,
          total: 0,
          routes: [],
        };
        grouped.set(driverId, line);
      }

      line.routes.push({
        routeId: route.id,
        routeName: route.routeName ?? null,
        location: route.location ?? null,
        scheduleDate: route.scheduleDate,
        completedAt: route.completedAt ?? null,
        rate: STANDARD_ROUTE_RATE,
      });
      line.routeCount += 1;
      line.basePay += STANDARD_ROUTE_RATE;
    }

    const lineItems = Array.from(grouped.values()).map((line) => ({
      ...line,
      total: line.basePay + line.bonus - line.deduction,
    }));
    const totalAmount = lineItems.reduce((sum, line) => sum + line.total, 0);

    const bill = new PayrollBill({
      teamId: actor.teamId,
      teamName: team.name,
      teamNumber: team.teamNumber,
      periodStart,
      periodEnd,
      status: PayrollStatus.DRAFT,
      standardRate: STANDARD_ROUTE_RATE,
      lineItems,
      totalAmount,
      createdBy: actor.id,
      createdByName: nameById.get(actor.id) ?? 'Team Lead',
    });

    return this.payrollRepo.save(bill);
  }
}
