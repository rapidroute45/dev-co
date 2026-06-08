import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { publicUploadPath } from '../../../../shared/upload/upload.config';
import { mapPayrollBillToResponse } from '../../application/mappers/payrollResponse.mapper';
import { GeneratePayrollBillUseCase } from '../../application/use-cases/generatePayrollBill.use-case';
import { ListPayrollBillsUseCase } from '../../application/use-cases/listPayrollBills.use-case';
import { GetPayrollBillUseCase } from '../../application/use-cases/getPayrollBill.use-case';
import { UpdatePayrollBillUseCase } from '../../application/use-cases/updatePayrollBill.use-case';
import { DeletePayrollBillUseCase } from '../../application/use-cases/deletePayrollBill.use-case';
import { SendPayrollToTeamLeadUseCase } from '../../application/use-cases/sendPayrollToTeamLead.use-case';
import {
  TeamLeadApprovePayrollUseCase,
  TeamLeadDisputePayrollUseCase,
} from '../../application/use-cases/teamLeadReviewPayroll.use-case';
import { MarkPayrollPaidUseCase } from '../../application/use-cases/markPayrollPaid.use-case';
import { GetPayrollPendingSummaryUseCase } from '../../application/use-cases/getPayrollPendingSummary.use-case';
import {
  GetPayrollSettingsUseCase,
  UpdatePayrollSettingsUseCase,
} from '../../application/use-cases/payrollSettings.use-case';
import { PreviewPayrollUseCase } from '../../application/use-cases/previewPayroll.use-case';
import { UpsertRoutePayAdjustmentUseCase } from '../../application/use-cases/upsertRoutePayAdjustment.use-case';
import { AcknowledgePayrollBillUseCase } from '../../application/use-cases/acknowledgePayrollBill.use-case';
import { ListPayrollAuditLogUseCase } from '../../application/use-cases/listPayrollAuditLog.use-case';
import { ExportPayrollReportUseCase } from '../../application/use-cases/exportPayrollReport.use-case';
import { GetStoreBillingSettingsUseCase } from '../../application/use-cases/getStoreBillingSettings.use-case';
import { UpdateStoreBillingSettingsUseCase } from '../../application/use-cases/updateStoreBillingSettings.use-case';
import { GetStorePayrollSummaryUseCase } from '../../application/use-cases/getStorePayrollSummary.use-case';
import { GetStorePayrollDetailUseCase } from '../../application/use-cases/getStorePayrollDetail.use-case';
import { GetStoreBillingRatesUseCase } from '../../application/use-cases/getStoreBillingRates.use-case';
import { UpdateStoreBillingRatesUseCase } from '../../application/use-cases/updateStoreBillingRates.use-case';
import { GetPayrollRatesUseCase } from '../../application/use-cases/getPayrollRates.use-case';
import { UpdatePayrollRatesUseCase } from '../../application/use-cases/updatePayrollRates.use-case';
import {
  BuildStoreInvoiceUseCase,
  ListInvoiceBillTosUseCase,
  UpsertInvoiceBillToUseCase,
} from '../../application/use-cases/storeInvoice.use-case';

export class PayrollController {
  constructor(
    private generateUseCase: GeneratePayrollBillUseCase,
    private pendingSummaryUseCase: GetPayrollPendingSummaryUseCase,
    private listUseCase: ListPayrollBillsUseCase,
    private getUseCase: GetPayrollBillUseCase,
    private updatePayrollBillUseCase: UpdatePayrollBillUseCase,
    private deletePayrollBillUseCase: DeletePayrollBillUseCase,
    private sendToTeamLeadUseCase: SendPayrollToTeamLeadUseCase,
    private teamLeadApproveUseCase: TeamLeadApprovePayrollUseCase,
    private teamLeadDisputeUseCase: TeamLeadDisputePayrollUseCase,
    private markPaidUseCase: MarkPayrollPaidUseCase,
    private getSettingsUseCase: GetPayrollSettingsUseCase,
    private updateSettingsUseCase: UpdatePayrollSettingsUseCase,
    private previewUseCase: PreviewPayrollUseCase,
    private upsertRouteAdjustmentUseCase: UpsertRoutePayAdjustmentUseCase,
    private acknowledgeUseCase: AcknowledgePayrollBillUseCase,
    private auditLogUseCase: ListPayrollAuditLogUseCase,
    private exportReportUseCase: ExportPayrollReportUseCase,
    private getStoreBillingSettingsUseCase: GetStoreBillingSettingsUseCase,
    private updateStoreBillingSettingsUseCase: UpdateStoreBillingSettingsUseCase,
    private getStorePayrollSummaryUseCase: GetStorePayrollSummaryUseCase,
    private getStorePayrollDetailUseCase: GetStorePayrollDetailUseCase,
    private getStoreBillingRatesUseCase: GetStoreBillingRatesUseCase,
    private updateStoreBillingRatesUseCase: UpdateStoreBillingRatesUseCase,
    private getPayrollRatesUseCase: GetPayrollRatesUseCase,
    private updatePayrollRatesUseCase: UpdatePayrollRatesUseCase,
    private listInvoiceBillTosUseCase: ListInvoiceBillTosUseCase,
    private upsertInvoiceBillToUseCase: UpsertInvoiceBillToUseCase,
    private buildStoreInvoiceUseCase: BuildStoreInvoiceUseCase
  ) {}

  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const data = await this.getSettingsUseCase.execute(req.user.role);
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const data = await this.updateSettingsUseCase.execute(
        { id: req.user.id, role: req.user.role },
        req.body
      );
      res.status(200).json({
        success: true,
        message: 'Payroll settings saved.',
        data,
      });
    } catch (e) {
      next(e);
    }
  };

  getPayrollRates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const data = await this.getPayrollRatesUseCase.execute(
        String(req.params.storeId)
      );
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  updatePayrollRates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const storeId = String(req.params.storeId);
      const { useDefaultRates, smallRouteRate, mediumRouteRate, fullRouteRate } = req.body as {
        useDefaultRates?: boolean;
        smallRouteRate?: number;
        mediumRouteRate?: number;
        fullRouteRate?: number;
      };
      const data = await this.updatePayrollRatesUseCase.execute(storeId, {
        useDefaultRates: Boolean(useDefaultRates),
        smallRouteRate:
          smallRouteRate !== undefined ? Number(smallRouteRate) : undefined,
        mediumRouteRate:
          mediumRouteRate !== undefined ? Number(mediumRouteRate) : undefined,
        fullRouteRate: fullRouteRate !== undefined ? Number(fullRouteRate) : undefined,
        updatedBy: req.user.id,
      });
      res.status(200).json({
        success: true,
        message: useDefaultRates
          ? 'Store now uses default driver pay rates.'
          : 'Store driver pay rates saved.',
        data,
      });
    } catch (e) {
      next(e);
    }
  };

  preview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const data = await this.previewUseCase.execute(
        { role: req.user.role, teamId: req.user.teamId },
        req.query as { teamId?: string; periodStart?: string; periodEnd?: string }
      );
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  upsertRouteAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const data = await this.upsertRouteAdjustmentUseCase.execute(
        { id: req.user.id, role: req.user.role },
        String(req.params.routeId),
        req.body
      );
      res.status(200).json({
        success: true,
        message: 'Route pay adjustment saved.',
        data,
      });
    } catch (e) {
      next(e);
    }
  };

  auditLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const data = await this.auditLogUseCase.execute(req.user, req.query as Record<string, string>);
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  exportReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const report = await this.exportReportUseCase.execute(
        { role: req.user.role },
        req.query as Record<string, string>
      );
      res.setHeader('Content-Type', report.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
      res.status(200).send(report.body);
    } catch (e) {
      next(e);
    }
  };

  pendingSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const summary = await this.pendingSummaryUseCase.execute({
        role: req.user.role,
        teamId: req.user.teamId,
      });
      res.status(200).json({ success: true, data: summary });
    } catch (e) {
      next(e);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const status = req.query.status as PayrollStatus | undefined;
      const teamId = req.query.teamId as string | undefined;
      const bills = await this.listUseCase.execute(
        { role: req.user.role, teamId: req.user.teamId },
        { status, teamId }
      );
      res.status(200).json({ success: true, data: bills.map(mapPayrollBillToResponse) });
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const bill = await this.getUseCase.execute(
        { role: req.user.role, teamId: req.user.teamId },
        String(req.params.id)
      );
      res.status(200).json({ success: true, data: mapPayrollBillToResponse(bill) });
    } catch (e) {
      next(e);
    }
  };

  generate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { teamId, routeIds, periodStart, periodEnd, adjustments } = req.body as {
        teamId?: string;
        routeIds?: string[];
        periodStart?: string;
        periodEnd?: string;
        adjustments?: {
          driverId: string;
          bonus?: number;
          deduction?: number;
          overtime?: number;
        }[];
      };
      if (!teamId) {
        return next(new AppError('teamId is required.', 400));
      }
      const bill = await this.generateUseCase.execute(
        { id: req.user.id, role: req.user.role },
        { teamId, routeIds, periodStart, periodEnd, adjustments }
      );
      res.status(201).json({
        success: true,
        message: 'Payroll bill created from completed routes.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };

  updateBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { adjustments, note, standardRate, removeRouteIds } = req.body as {
        adjustments?: {
          driverId: string;
          bonus?: number;
          deduction?: number;
          overtime?: number;
        }[];
        note?: string | null;
        standardRate?: number;
        removeRouteIds?: string[];
      };
      const bill = await this.updatePayrollBillUseCase.execute(
        { role: req.user.role },
        String(req.params.id),
        {
          adjustments: adjustments ?? [],
          note,
          standardRate,
          removeRouteIds,
        }
      );
      res.status(200).json({
        success: true,
        message: 'Payroll bill updated.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };

  /** @deprecated Prefer PUT /bills/:id — kept for older clients. */
  updateLineItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { adjustments, note } = req.body as {
        adjustments?: {
          driverId: string;
          bonus?: number;
          deduction?: number;
          overtime?: number;
        }[];
        note?: string | null;
      };
      const bill = await this.updatePayrollBillUseCase.execute(
        { role: req.user.role },
        String(req.params.id),
        { adjustments: adjustments ?? [], note }
      );
      res.status(200).json({
        success: true,
        message: 'Payroll bill updated.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };

  deleteBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      await this.deletePayrollBillUseCase.execute(
        { role: req.user.role },
        String(req.params.id)
      );
      res.status(200).json({
        success: true,
        message: 'Payroll bill deleted.',
      });
    } catch (e) {
      next(e);
    }
  };

  sendToTeamLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const bill = await this.sendToTeamLeadUseCase.execute(
        { id: req.user.id, role: req.user.role },
        String(req.params.id)
      );
      res.status(200).json({
        success: true,
        message: 'Payroll sent to team lead for approval.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };

  acknowledge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const bill = await this.acknowledgeUseCase.execute(
        { id: req.user.id, role: req.user.role, teamId: req.user.teamId },
        String(req.params.id)
      );
      res.status(200).json({
        success: true,
        message: 'Payroll acknowledged.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };

  teamLeadApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const bill = await this.teamLeadApproveUseCase.execute(
        { id: req.user.id, role: req.user.role, teamId: req.user.teamId },
        String(req.params.id)
      );
      res.status(200).json({
        success: true,
        message: 'Payroll approved. Dispatch will process payment.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };

  teamLeadDispute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { note } = req.body as { note?: string };
      const bill = await this.teamLeadDisputeUseCase.execute(
        { role: req.user.role, teamId: req.user.teamId },
        String(req.params.id),
        note ?? ''
      );
      res.status(200).json({
        success: true,
        message: 'Issue sent to dispatch.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };

  getStoreBillingSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const data = await this.getStoreBillingSettingsUseCase.execute();
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  updateStoreBillingSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const {
        smallRouteRate,
        mediumRouteRate,
        fullRouteRate,
        overtimeHourlyRate,
        weeklyPerformanceIncentive,
      } = req.body as {
        smallRouteRate?: number;
        mediumRouteRate?: number;
        fullRouteRate?: number;
        overtimeHourlyRate?: number;
        weeklyPerformanceIncentive?: number;
      };
      const data = await this.updateStoreBillingSettingsUseCase.execute({
        smallRouteRate: Number(smallRouteRate),
        mediumRouteRate: Number(mediumRouteRate),
        fullRouteRate: Number(fullRouteRate),
        overtimeHourlyRate: Number(overtimeHourlyRate ?? 30),
        weeklyPerformanceIncentive: Number(weeklyPerformanceIncentive ?? 0),
        updatedBy: req.user.id,
      });
      res.status(200).json({
        success: true,
        message: 'Store billing rates saved.',
        data,
      });
    } catch (e) {
      next(e);
    }
  };

  getStoreBillingRates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const data = await this.getStoreBillingRatesUseCase.execute(
        String(req.params.storeId)
      );
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  updateStoreBillingRates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const storeId = String(req.params.storeId);
      const { useDefaultRates, smallRouteRate, mediumRouteRate, fullRouteRate } = req.body as {
        useDefaultRates?: boolean;
        smallRouteRate?: number;
        mediumRouteRate?: number;
        fullRouteRate?: number;
      };
      const data = await this.updateStoreBillingRatesUseCase.execute(storeId, {
        useDefaultRates: Boolean(useDefaultRates),
        smallRouteRate:
          smallRouteRate !== undefined ? Number(smallRouteRate) : undefined,
        mediumRouteRate:
          mediumRouteRate !== undefined ? Number(mediumRouteRate) : undefined,
        fullRouteRate: fullRouteRate !== undefined ? Number(fullRouteRate) : undefined,
        updatedBy: req.user.id,
      });
      res.status(200).json({
        success: true,
        message: useDefaultRates
          ? 'Store now uses default billing rates.'
          : 'Store billing rates saved.',
        data,
      });
    } catch (e) {
      next(e);
    }
  };

  storePayrollSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { periodStart, periodEnd, search, city, state } = req.query as {
        periodStart?: string;
        periodEnd?: string;
        search?: string;
        city?: string;
        state?: string;
      };
      const data = await this.getStorePayrollSummaryUseCase.execute(
        {
          periodStart,
          periodEnd,
          search,
          city,
          state,
        },
        req.user
      );
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  storePayrollDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { periodStart, periodEnd } = req.query as {
        periodStart?: string;
        periodEnd?: string;
      };
      const data = await this.getStorePayrollDetailUseCase.execute(
        {
          storeId: String(req.params.storeId),
          periodStart,
          periodEnd,
        },
        req.user
      );
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  listInvoiceBillTos = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const data = await this.listInvoiceBillTosUseCase.execute();
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  upsertInvoiceBillTo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { name, address } = req.body as { name?: string; address?: string };
      const data = await this.upsertInvoiceBillToUseCase.execute({
        name: String(name ?? ''),
        address: String(address ?? ''),
        updatedBy: req.user.id,
      });
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  previewStoreInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const {
        periodStart,
        periodEnd,
        search,
        city,
        state,
        billToName,
        billToAddress,
        weeklyPerformanceIncentiveRate,
      } = req.query as Record<string, string | undefined>;
      const data = await this.buildStoreInvoiceUseCase.execute(
        {
          periodStart: periodStart ?? '',
          periodEnd: periodEnd ?? '',
          search,
          city,
          state,
          billToName,
          billToAddress,
          weeklyPerformanceIncentiveRate:
            weeklyPerformanceIncentiveRate !== undefined
              ? Number(weeklyPerformanceIncentiveRate)
              : undefined,
          saveBillTo: false,
        },
        req.user
      );
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  generateStoreInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const {
        periodStart,
        periodEnd,
        search,
        city,
        state,
        billToName,
        billToAddress,
        weeklyPerformanceIncentiveRate,
      } = req.body as Record<string, string | number | undefined>;
      const data = await this.buildStoreInvoiceUseCase.execute(
        {
          periodStart: String(periodStart ?? ''),
          periodEnd: String(periodEnd ?? ''),
          search: search ? String(search) : undefined,
          city: city ? String(city) : undefined,
          state: state ? String(state) : undefined,
          billToName: billToName ? String(billToName) : undefined,
          billToAddress: billToAddress ? String(billToAddress) : undefined,
          weeklyPerformanceIncentiveRate:
            weeklyPerformanceIncentiveRate !== undefined
              ? Number(weeklyPerformanceIncentiveRate)
              : undefined,
          saveBillTo: true,
          updatedBy: req.user.id,
        },
        req.user
      );
      res.status(200).json({
        success: true,
        message: 'Invoice generated.',
        data,
      });
    } catch (e) {
      next(e);
    }
  };

  markPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const file = req.file;
      if (!file) return next(new AppError('receipt image is required.', 400));
      const receiptUrl = publicUploadPath(file.filename);
      const bill = await this.markPaidUseCase.execute(
        { id: req.user.id, role: req.user.role },
        String(req.params.id),
        receiptUrl
      );
      res.status(200).json({
        success: true,
        message: 'Payment recorded. Receipt is visible to the team lead.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };
}
