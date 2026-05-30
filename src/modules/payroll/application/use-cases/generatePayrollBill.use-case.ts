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
    if (existing && existing.status === PayrollStatus.APPROVED) {
      throw new AppError('This period has already been approved and is locked.', 409);
    }

    const routes = await this.routeRepo.findCompletedByTeamInRange(
      actor.teamId,
      periodStart,
      periodEnd
    );

    if (routes.length === 0 && !existing) {
      throw new AppError('No completed routes for this team in the selected period.', 400);
    }

    const members = await this.userRepo.findManyByTeamId(actor.teamId);
    const nameById = new Map<string, string>();
    members.forEach((m) => {
      if (m.id) nameById.set(m.id, m.fullName?.trim() || m.email);
    });

    // Preserve any bonus/deduction the team lead already entered.
    const prevByDriver = new Map<string, { bonus: number; deduction: number }>();
    existing?.lineItems.forEach((line) => {
      prevByDriver.set(line.driverId, { bonus: line.bonus, deduction: line.deduction });
    });

    const grouped = new Map<string, PayrollDriverLine>();
    for (const route of routes) {
      const driverId = route.driverId;
      if (!driverId || !route.id) continue;

      let line = grouped.get(driverId);
      if (!line) {
        const prev = prevByDriver.get(driverId);
        line = {
          driverId,
          driverName: nameById.get(driverId) ?? 'Driver',
          routeCount: 0,
          basePay: 0,
          bonus: prev?.bonus ?? 0,
          deduction: prev?.deduction ?? 0,
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

    if (existing?.id) {
      const updated = await this.payrollRepo.update(existing.id, {
        lineItems,
        totalAmount,
        status: PayrollStatus.DRAFT,
        rejectionReason: null,
      });
      if (!updated) throw new AppError('Failed to update payroll bill.', 500);
      return updated;
    }

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
