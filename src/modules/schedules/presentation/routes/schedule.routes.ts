import { Router } from 'express';
import { dispatchOpsGuard } from '../../../../shared/middleware/dispatchOpsGuard';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { scheduleViewerGuard } from '../../../../shared/middleware/scheduleViewerGuard';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { TeamRepository } from '../../../teams/infrastructure/repositories/team.repository';
import { StoreRepository } from '../../../stores/infrastructure/repositories/store.repository';
import { NotificationRepository } from '../../../notifications/infrastructure/repositories/notification.repository';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { ScheduleRepository } from '../../infrastructure/repositories/schedule.repository';
import { RouteRepository } from '../../infrastructure/repositories/route.repository';
import { RouteStopRepository } from '../../infrastructure/repositories/routeStop.repository';
import { RouteStopEnrichmentService } from '../../application/services/routeStopEnrichment.service';
import { RouteAutoCompleteService } from '../../application/services/routeAutoComplete.service';
import { CreateScheduleUseCase } from '../../application/use-cases/createSchedule.use-case';
import { ListSchedulesUseCase } from '../../application/use-cases/listSchedules.use-case';
import { GetScheduleUseCase } from '../../application/use-cases/getSchedule.use-case';
import { UpdateScheduleUseCase } from '../../application/use-cases/updateSchedule.use-case';
import { DeleteScheduleUseCase } from '../../application/use-cases/deleteSchedule.use-case';
import { ListTeamLeadScheduleAlertsUseCase } from '../../application/use-cases/listTeamLeadScheduleAlerts.use-case';
import { AcknowledgeTeamLeadScheduleAlertUseCase } from '../../application/use-cases/acknowledgeTeamLeadScheduleAlert.use-case';
import { TeamLeadScheduleAlertRepository } from '../../infrastructure/repositories/teamLeadScheduleAlert.repository';
import { TeamLeadScheduleAlertService } from '../../application/services/teamLeadScheduleAlert.service';
import { teamLeadGuard } from '../../../../shared/middleware/teamLeadGuard';
import { requireDispatchElevation } from '../../../../shared/middleware/opsElevation.middleware';
import { ScheduleController } from '../controllers/schedule.controller';

const router = Router();

const scheduleRepo = new ScheduleRepository();
const routeRepo = new RouteRepository();
const routeStopRepo = new RouteStopRepository();
const storeRepo = new StoreRepository();
const userRepo = new UserRepository();
const teamRepo = new TeamRepository();
const routeStopEnrichment = new RouteStopEnrichmentService(routeStopRepo);
const notificationRepo = new NotificationRepository();
const notificationService = new NotificationService(notificationRepo);
const routeAutoComplete = new RouteAutoCompleteService(routeRepo, routeStopRepo);
const teamLeadAlertRepo = new TeamLeadScheduleAlertRepository();
const teamLeadAlertService = new TeamLeadScheduleAlertService(
  teamLeadAlertRepo,
  scheduleRepo,
  routeRepo,
  storeRepo,
  teamRepo,
  notificationService
);

const controller = new ScheduleController(
  new CreateScheduleUseCase(scheduleRepo, storeRepo, notificationService, userRepo),
  new ListSchedulesUseCase(scheduleRepo, storeRepo, routeRepo, userRepo),
  new GetScheduleUseCase(
    scheduleRepo,
    storeRepo,
    routeRepo,
    userRepo,
    teamRepo,
    routeStopEnrichment,
    teamLeadAlertService,
    routeAutoComplete
  ),
  new UpdateScheduleUseCase(
    scheduleRepo,
    storeRepo,
    routeRepo,
    notificationService,
    userRepo
  ),
  new DeleteScheduleUseCase(
    scheduleRepo,
    routeRepo,
    routeStopRepo,
    teamLeadAlertRepo
  ),
  new ListTeamLeadScheduleAlertsUseCase(teamLeadAlertService),
  new AcknowledgeTeamLeadScheduleAlertUseCase(teamLeadAlertService)
);

router.post('/', [...dispatchOpsGuard, requireDispatchElevation], controller.create);
router.get('/team-lead/alerts', teamLeadGuard, controller.listTeamLeadAlerts);
router.post(
  '/team-lead/alerts/:scheduleId/dismiss',
  teamLeadGuard,
  controller.dismissTeamLeadAlert
);
router.get('/', scheduleViewerGuard, controller.list);
router.get('/:id', scheduleViewerGuard, controller.getById);
router.put('/:id', [...dispatchOpsGuard, requireDispatchElevation], controller.update);
router.delete('/:id', [...managerGuard, requireDispatchElevation], controller.delete);

export default router;
