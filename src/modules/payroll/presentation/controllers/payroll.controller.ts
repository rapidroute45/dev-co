import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { publicUploadPath } from '../../../../shared/upload/upload.config';
import { mapPayrollBillToResponse } from '../../application/mappers/payrollResponse.mapper';
import { GeneratePayrollBillUseCase } from '../../application/use-cases/generatePayrollBill.use-case';
import { ListPayrollBillsUseCase } from '../../application/use-cases/listPayrollBills.use-case';
import { GetPayrollBillUseCase } from '../../application/use-cases/getPayrollBill.use-case';
import { UpdatePayrollLineItemsUseCase } from '../../application/use-cases/updatePayrollLineItems.use-case';
import { SendPayrollToTeamLeadUseCase } from '../../application/use-cases/sendPayrollToTeamLead.use-case';
import {
  TeamLeadApprovePayrollUseCase,
  TeamLeadDisputePayrollUseCase,
} from '../../application/use-cases/teamLeadReviewPayroll.use-case';
import { MarkPayrollPaidUseCase } from '../../application/use-cases/markPayrollPaid.use-case';
import { GetPayrollPendingSummaryUseCase } from '../../application/use-cases/getPayrollPendingSummary.use-case';

export class PayrollController {
  constructor(
    private generateUseCase: GeneratePayrollBillUseCase,
    private pendingSummaryUseCase: GetPayrollPendingSummaryUseCase,
    private listUseCase: ListPayrollBillsUseCase,
    private getUseCase: GetPayrollBillUseCase,
    private updateLineItemsUseCase: UpdatePayrollLineItemsUseCase,
    private sendToTeamLeadUseCase: SendPayrollToTeamLeadUseCase,
    private teamLeadApproveUseCase: TeamLeadApprovePayrollUseCase,
    private teamLeadDisputeUseCase: TeamLeadDisputePayrollUseCase,
    private markPaidUseCase: MarkPayrollPaidUseCase
  ) {}

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
      const { teamId, routeIds } = req.body as { teamId?: string; routeIds?: string[] };
      if (!teamId) {
        return next(new AppError('teamId is required.', 400));
      }
      const bill = await this.generateUseCase.execute(
        { id: req.user.id, role: req.user.role },
        { teamId, routeIds }
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

  updateLineItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { adjustments, note } = req.body as {
        adjustments?: { driverId: string; bonus?: number; deduction?: number }[];
        note?: string;
      };
      const bill = await this.updateLineItemsUseCase.execute(
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

  sendToTeamLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const bill = await this.sendToTeamLeadUseCase.execute(
        { role: req.user.role },
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

  teamLeadApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const bill = await this.teamLeadApproveUseCase.execute(
        { role: req.user.role, teamId: req.user.teamId },
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
