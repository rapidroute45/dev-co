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
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { NotificationRepository } from '../../../notifications/infrastructure/repositories/notification.repository';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { PayrollBillRepository } from '../../infrastructure/repositories/payrollBill.repository';
import { PayrollSettingsRepository } from '../../infrastructure/repositories/payrollSettings.repository';
import { PayrollRateOverrideRepository } from '../../infrastructure/repositories/payrollRateOverride.repository';
import { PayrollRouteAdjustmentRepository } from '../../infrastructure/repositories/payrollRouteAdjustment.repository';
import { PayrollAuditLogRepository } from '../../infrastructure/repositories/payrollAuditLog.repository';
import { PayrollAuditService } from '../../application/services/payrollAudit.service';
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
import { PayrollController } from '../controllers/payroll.controller';

const router = Router();

const payrollRepo = new PayrollBillRepository();
const routeRepo = new RouteRepository();
const userRepo = new UserRepository();
const teamRepo = new TeamRepository();
const settingsRepo = new PayrollSettingsRepository();
const payrollOverrideRepo = new PayrollRateOverrideRepository();
const scheduleRepo = new ScheduleRepository();
const adjustmentRepo = new PayrollRouteAdjustmentRepository();
const auditRepo = new PayrollAuditLogRepository();
const auditService = new PayrollAuditService(auditRepo);
const notificationService = new NotificationService(new NotificationRepository());

const controller = new PayrollController(
  new GeneratePayrollBillUseCase(
    payrollRepo,
    routeRepo,
    userRepo,
    teamRepo,
    settingsRepo,
    payrollOverrideRepo,
    scheduleRepo,
    adjustmentRepo,
    auditService,
    notificationService
  ),
  new GetPayrollPendingSummaryUseCase(
    payrollRepo,
    routeRepo,
    userRepo,
    teamRepo,
    settingsRepo,
    payrollOverrideRepo,
    scheduleRepo,
    adjustmentRepo
  ),
  new ListPayrollBillsUseCase(payrollRepo),
  new GetPayrollBillUseCase(payrollRepo),
  new UpdatePayrollBillUseCase(payrollRepo),
  new DeletePayrollBillUseCase(payrollRepo),
  new SendPayrollToTeamLeadUseCase(
    payrollRepo,
    teamRepo,
    userRepo,
    auditService,
    notificationService
  ),
  new TeamLeadApprovePayrollUseCase(
    payrollRepo,
    userRepo,
    auditService,
    notificationService
  ),
  new TeamLeadDisputePayrollUseCase(payrollRepo),
  new MarkPayrollPaidUseCase(payrollRepo, userRepo),
  new GetPayrollSettingsUseCase(settingsRepo),
  new UpdatePayrollSettingsUseCase(settingsRepo, auditService, userRepo),
  new PreviewPayrollUseCase(
    payrollRepo,
    routeRepo,
    userRepo,
    teamRepo,
    settingsRepo,
    payrollOverrideRepo,
    scheduleRepo,
    adjustmentRepo
  ),
  new UpsertRoutePayAdjustmentUseCase(
    routeRepo,
    settingsRepo,
    payrollOverrideRepo,
    scheduleRepo,
    adjustmentRepo,
    auditService,
    userRepo
  ),
  new AcknowledgePayrollBillUseCase(payrollRepo, auditService, userRepo),
  new ListPayrollAuditLogUseCase(auditRepo),
  new ExportPayrollReportUseCase(payrollRepo),
  new GetStoreBillingSettingsUseCase(),
  new UpdateStoreBillingSettingsUseCase(),
  new GetStorePayrollSummaryUseCase(),
  new GetStorePayrollDetailUseCase(),
  new GetStoreBillingRatesUseCase(),
  new UpdateStoreBillingRatesUseCase(),
  new GetPayrollRatesUseCase(),
  new UpdatePayrollRatesUseCase(),
  new ListInvoiceBillTosUseCase(),
  new UpsertInvoiceBillToUseCase(),
  new BuildStoreInvoiceUseCase()
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

const payrollSettingsGuard = [
  requireAuth(),
  requireRoles(UserRole.ADMIN, UserRole.DISPATCH_MANAGER),
];

router.get('/settings', payrollSettingsGuard, controller.getSettings);
router.put('/settings', payrollSettingsGuard, controller.updateSettings);
router.get(
  '/settings/stores/:storeId',
  payrollSettingsGuard,
  controller.getPayrollRates
);
router.put(
  '/settings/stores/:storeId',
  payrollSettingsGuard,
  controller.updatePayrollRates
);
router.get('/store-billing-settings', payrollSettingsGuard, controller.getStoreBillingSettings);
router.put('/store-billing-settings', payrollSettingsGuard, controller.updateStoreBillingSettings);
router.get(
  '/store-billing-settings/stores/:storeId',
  payrollSettingsGuard,
  controller.getStoreBillingRates
);
router.put(
  '/store-billing-settings/stores/:storeId',
  payrollSettingsGuard,
  controller.updateStoreBillingRates
);
router.get('/store-payroll/summary', payrollViewerGuard, controller.storePayrollSummary);
router.get('/store-payroll/stores/:storeId', payrollViewerGuard, controller.storePayrollDetail);
router.get('/store-invoice/bill-tos', payrollSettingsGuard, controller.listInvoiceBillTos);
router.post('/store-invoice/bill-tos', payrollSettingsGuard, controller.upsertInvoiceBillTo);
router.get('/store-invoice/preview', payrollSettingsGuard, controller.previewStoreInvoice);
router.post('/store-invoice/generate', payrollSettingsGuard, controller.generateStoreInvoice);
router.get('/preview', payrollViewerGuard, controller.preview);
router.put('/route-adjustments/:routeId', payrollSettingsGuard, controller.upsertRouteAdjustment);
router.get('/audit-log', payrollSettingsGuard, controller.auditLog);
router.get('/reports/export', payrollViewerGuard, controller.exportReport);

router.get('/pending-summary', payrollViewerGuard, controller.pendingSummary);
router.get('/bills', payrollViewerGuard, controller.list);
router.get('/bills/:id', payrollViewerGuard, controller.getById);
router.post('/bills/generate', managerGuard, controller.generate);
router.put('/bills/:id', managerGuard, controller.updateBill);
router.patch('/bills/:id/line-items', managerGuard, controller.updateLineItems);
router.delete('/bills/:id', managerGuard, controller.deleteBill);
router.post('/bills/:id/send-to-team-lead', managerGuard, controller.sendToTeamLead);
router.post('/bills/:id/acknowledge', teamLeadGuard, controller.acknowledge);
router.post('/bills/:id/team-lead/approve', teamLeadGuard, controller.teamLeadApprove);
router.post('/bills/:id/team-lead/dispute', teamLeadGuard, controller.teamLeadDispute);
router.post(
  '/bills/:id/mark-paid',
  managerGuard,
  uploadMiddleware.single('receipt'),
  controller.markPaid
);

export default router;
