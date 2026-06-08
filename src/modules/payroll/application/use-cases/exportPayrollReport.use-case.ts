import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { IPayrollRepository } from '../../domain/interfaces/payroll-repository.interface';
import { formatScheduleDate } from '../../../schedules/application/utils/scheduleDate';
import { parsePayrollPeriodInput } from '../utils/unbilledPayrollRoutes';

const OPS_ROLES = [UserRole.ADMIN, UserRole.DISPATCH_MANAGER, UserRole.ACCOUNTANT];

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export class ExportPayrollReportUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(
    actor: { role: UserRole | null },
    query: {
      periodStart?: string;
      periodEnd?: string;
      teamId?: string;
      driverId?: string;
      status?: string;
      routeCategory?: string;
    }
  ): Promise<{ filename: string; contentType: string; body: string }> {
    if (!actor.role || !OPS_ROLES.includes(actor.role)) {
      throw new AppError('You do not have access to payroll reports.', 403);
    }

    const bills = await this.payrollRepo.findMany({
      teamId: query.teamId?.trim() || undefined,
      status: query.status?.trim() as PayrollStatus | undefined,
    });

    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;
    if (query.periodStart && query.periodEnd) {
      try {
        ({ periodStart, periodEnd } = parsePayrollPeriodInput(
          query.periodStart,
          query.periodEnd
        ));
      } catch (e) {
        throw new AppError((e as Error).message, 400);
      }
    }

    const driverFilter = query.driverId?.trim();
    const categoryFilter = query.routeCategory?.trim().toUpperCase();

    const header = [
      'Team',
      'Driver',
      'Route ID',
      'Route Name',
      'Route Date',
      'Route Category',
      'Default Rate',
      'Final Pay',
      'Has Adjustment',
      'Bill Status',
      'Period Start',
      'Period End',
      'Bill Total',
    ].join(',');

    const rows: string[] = [header];

    for (const bill of bills) {
      if (periodStart && periodEnd) {
        if (
          bill.periodEnd.getTime() < periodStart.getTime() ||
          bill.periodStart.getTime() > periodEnd.getTime()
        ) {
          continue;
        }
      }
      for (const line of bill.lineItems) {
        if (driverFilter && line.driverId !== driverFilter) continue;
        for (const route of line.routes) {
          if (categoryFilter && route.routeCategory !== categoryFilter) continue;
          rows.push(
            [
              csvEscape(bill.teamName),
              csvEscape(line.driverName),
              csvEscape(route.routeId),
              csvEscape(route.routeName),
              csvEscape(formatScheduleDate(route.scheduleDate)),
              csvEscape(route.routeCategory),
              csvEscape(route.defaultRate),
              csvEscape(route.rate),
              csvEscape(route.hasAdjustment ? 'yes' : 'no'),
              csvEscape(bill.status),
              csvEscape(formatScheduleDate(bill.periodStart)),
              csvEscape(formatScheduleDate(bill.periodEnd)),
              csvEscape(bill.totalAmount),
            ].join(',')
          );
        }
      }
    }

    const filename = `payroll-report-${formatScheduleDate(new Date())}.csv`;
    return {
      filename,
      contentType: 'text/csv; charset=utf-8',
      body: rows.join('\n'),
    };
  }
}
