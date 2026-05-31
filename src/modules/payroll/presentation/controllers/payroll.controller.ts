import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { PayrollStatus } from '../../domain/entities/payrollBill.entity';
import { mapPayrollBillToResponse } from '../../application/mappers/payrollResponse.mapper';
import { GeneratePayrollBillUseCase } from '../../application/use-cases/generatePayrollBill.use-case';
import { ListPayrollBillsUseCase } from '../../application/use-cases/listPayrollBills.use-case';
import { GetPayrollBillUseCase } from '../../application/use-cases/getPayrollBill.use-case';
import { UpdatePayrollLineItemsUseCase } from '../../application/use-cases/updatePayrollLineItems.use-case';
import { SubmitPayrollBillUseCase } from '../../application/use-cases/submitPayrollBill.use-case';
import { ReviewPayrollBillUseCase } from '../../application/use-cases/reviewPayrollBill.use-case';

export class PayrollController {
  constructor(
    private generateUseCase: GeneratePayrollBillUseCase,
    private listUseCase: ListPayrollBillsUseCase,
    private getUseCase: GetPayrollBillUseCase,
    private updateLineItemsUseCase: UpdatePayrollLineItemsUseCase,
    private submitUseCase: SubmitPayrollBillUseCase,
    private reviewUseCase: ReviewPayrollBillUseCase
  ) {}

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
      const { periodStart, periodEnd } = req.body as {
        periodStart?: string;
        periodEnd?: string;
      };
      if (!periodStart || !periodEnd) {
        return next(new AppError('periodStart and periodEnd are required.', 400));
      }
      const bill = await this.generateUseCase.execute(
        { id: req.user.id, role: req.user.role, teamId: req.user.teamId },
        { periodStart, periodEnd }
      );
      res.status(201).json({
        success: true,
        message: 'Payroll draft ready.',
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

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const bill = await this.submitUseCase.execute(
        { role: req.user.role, teamId: req.user.teamId },
        String(req.params.id)
      );
      res.status(200).json({
        success: true,
        message: 'Payroll bill submitted for approval.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const bill = await this.reviewUseCase.execute(
        { id: req.user.id, role: req.user.role },
        String(req.params.id),
        { action: 'approve' }
      );
      res.status(200).json({
        success: true,
        message: 'Payroll bill approved.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError('Unauthorized', 401));
      const { reason } = req.body as { reason?: string };
      const bill = await this.reviewUseCase.execute(
        { id: req.user.id, role: req.user.role },
        String(req.params.id),
        { action: 'reject', reason }
      );
      res.status(200).json({
        success: true,
        message: 'Payroll bill sent back to the team lead.',
        data: mapPayrollBillToResponse(bill),
      });
    } catch (e) {
      next(e);
    }
  };
}
