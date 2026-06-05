import { Router } from 'express';
import { UserRole } from '../../../../shared/constants/roles';
import { requireAuth } from '../../../../shared/middleware/auth.middleware';
import { requireRoles } from '../../../../shared/middleware/role.middleware';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { teamLeadGuard } from '../../../../shared/middleware/teamLeadGuard';
import { uploadMiddleware } from '../../../../shared/upload/upload.config';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { TeamRepository } from '../../../teams/infrastructure/repositories/team.repository';
import { RouteRepository } from '../../../schedules/infrastructure/repositories/route.repository';
import { PayrollBillRepository } from '../../infrastructure/repositories/payrollBill.repository';
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
import { PayrollController } from '../controllers/payroll.controller';

const router = Router();

const payrollRepo = new PayrollBillRepository();
const routeRepo = new RouteRepository();
const userRepo = new UserRepository();
const teamRepo = new TeamRepository();

const controller = new PayrollController(
  new GeneratePayrollBillUseCase(payrollRepo, routeRepo, userRepo, teamRepo),
  new GetPayrollPendingSummaryUseCase(payrollRepo, routeRepo, userRepo, teamRepo),
  new ListPayrollBillsUseCase(payrollRepo),
  new GetPayrollBillUseCase(payrollRepo),
  new UpdatePayrollBillUseCase(payrollRepo),
  new DeletePayrollBillUseCase(payrollRepo),
  new SendPayrollToTeamLeadUseCase(payrollRepo),
  new TeamLeadApprovePayrollUseCase(payrollRepo),
  new TeamLeadDisputePayrollUseCase(payrollRepo),
  new MarkPayrollPaidUseCase(payrollRepo, userRepo)
);

const payrollViewerGuard = [
  requireAuth(),
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TEAM_LEAD
  ),
];

router.get('/pending-summary', payrollViewerGuard, controller.pendingSummary);
router.get('/bills', payrollViewerGuard, controller.list);
router.get('/bills/:id', payrollViewerGuard, controller.getById);
router.post('/bills/generate', managerGuard, controller.generate);
router.put('/bills/:id', managerGuard, controller.updateBill);
router.patch('/bills/:id/line-items', managerGuard, controller.updateLineItems);
router.delete('/bills/:id', managerGuard, controller.deleteBill);
router.post('/bills/:id/send-to-team-lead', managerGuard, controller.sendToTeamLead);
router.post('/bills/:id/team-lead/approve', teamLeadGuard, controller.teamLeadApprove);
router.post('/bills/:id/team-lead/dispute', teamLeadGuard, controller.teamLeadDispute);
router.post(
  '/bills/:id/mark-paid',
  managerGuard,
  uploadMiddleware.single('receipt'),
  controller.markPaid
);

export default router;
