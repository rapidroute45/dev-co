import { Router } from 'express';
import { UserRole } from '../../../../shared/constants/roles';
import { requireAuth } from '../../../../shared/middleware/auth.middleware';
import { requireRoles } from '../../../../shared/middleware/role.middleware';
import { teamLeadGuard } from '../../../../shared/middleware/teamLeadGuard';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { TeamRepository } from '../../../teams/infrastructure/repositories/team.repository';
import { RouteRepository } from '../../../schedules/infrastructure/repositories/route.repository';
import { PayrollBillRepository } from '../../infrastructure/repositories/payrollBill.repository';
import { GeneratePayrollBillUseCase } from '../../application/use-cases/generatePayrollBill.use-case';
import { ListPayrollBillsUseCase } from '../../application/use-cases/listPayrollBills.use-case';
import { GetPayrollBillUseCase } from '../../application/use-cases/getPayrollBill.use-case';
import { UpdatePayrollLineItemsUseCase } from '../../application/use-cases/updatePayrollLineItems.use-case';
import { SubmitPayrollBillUseCase } from '../../application/use-cases/submitPayrollBill.use-case';
import { ReviewPayrollBillUseCase } from '../../application/use-cases/reviewPayrollBill.use-case';
import { PayrollController } from '../controllers/payroll.controller';

const router = Router();

const payrollRepo = new PayrollBillRepository();
const routeRepo = new RouteRepository();
const userRepo = new UserRepository();
const teamRepo = new TeamRepository();

const controller = new PayrollController(
  new GeneratePayrollBillUseCase(payrollRepo, routeRepo, userRepo, teamRepo),
  new ListPayrollBillsUseCase(payrollRepo),
  new GetPayrollBillUseCase(payrollRepo),
  new UpdatePayrollLineItemsUseCase(payrollRepo),
  new SubmitPayrollBillUseCase(payrollRepo),
  new ReviewPayrollBillUseCase(payrollRepo, userRepo)
);

/** Team leads + dispatch staff (admin / dispatch manager / accountant). Drivers are never allowed. */
const payrollViewerGuard = [
  requireAuth(),
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TEAM_LEAD
  ),
];

/** Only dispatch staff can approve/reject. */
const payrollReviewGuard = [
  requireAuth(),
  requireRoles(UserRole.ADMIN, UserRole.DISPATCH_MANAGER, UserRole.ACCOUNTANT),
];

router.get('/bills', payrollViewerGuard, controller.list);
router.get('/bills/:id', payrollViewerGuard, controller.getById);
router.post('/bills/generate', teamLeadGuard, controller.generate);
router.patch('/bills/:id/line-items', payrollReviewGuard, controller.updateLineItems);
router.post('/bills/:id/submit', teamLeadGuard, controller.submit);
router.post('/bills/:id/approve', payrollReviewGuard, controller.approve);
router.post('/bills/:id/reject', payrollReviewGuard, controller.reject);

export default router;
