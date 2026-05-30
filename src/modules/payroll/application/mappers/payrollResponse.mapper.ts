import { PayrollBill } from '../../domain/entities/payrollBill.entity';
import { formatScheduleDate } from '../../../schedules/application/utils/scheduleDate';

export function mapPayrollBillToResponse(bill: PayrollBill) {
  return {
    id: bill.id,
    teamId: bill.teamId,
    teamName: bill.teamName,
    teamNumber: bill.teamNumber,
    periodStart: formatScheduleDate(bill.periodStart),
    periodEnd: formatScheduleDate(bill.periodEnd),
    status: bill.status,
    standardRate: bill.standardRate,
    totalAmount: bill.totalAmount,
    note: bill.note,
    createdBy: bill.createdBy,
    createdByName: bill.createdByName,
    submittedAt: bill.submittedAt ? bill.submittedAt.toISOString() : null,
    reviewedBy: bill.reviewedBy,
    reviewedByName: bill.reviewedByName,
    reviewedAt: bill.reviewedAt ? bill.reviewedAt.toISOString() : null,
    rejectionReason: bill.rejectionReason,
    lineItems: bill.lineItems.map((line) => ({
      driverId: line.driverId,
      driverName: line.driverName,
      routeCount: line.routeCount,
      basePay: line.basePay,
      bonus: line.bonus,
      deduction: line.deduction,
      total: line.total,
      routes: line.routes.map((r) => ({
        routeId: r.routeId,
        routeName: r.routeName,
        location: r.location,
        scheduleDate: formatScheduleDate(r.scheduleDate),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        rate: r.rate,
      })),
    })),
    createdAt: bill.createdAt ? bill.createdAt.toISOString() : null,
    updatedAt: bill.updatedAt ? bill.updatedAt.toISOString() : null,
  };
}
