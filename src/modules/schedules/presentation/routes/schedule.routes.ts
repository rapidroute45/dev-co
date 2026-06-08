import { Router } from 'express';
import { dispatchOpsGuard } from '../../../../shared/middleware/dispatchOpsGuard';
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
import { RouteValidationService } from '../../application/services/routeValidation.service';
import { CreateScheduleUseCase } from '../../application/use-cases/createSchedule.use-case';
import { ListSchedulesUseCase } from '../../application/use-cases/listSchedules.use-case';
import { GetScheduleUseCase } from '../../application/use-cases/getSchedule.use-case';
import { UpdateScheduleUseCase } from '../../application/use-cases/updateSchedule.use-case';
import { DeleteScheduleUseCase } from '../../application/use-cases/deleteSchedule.use-case';
import { ScheduleController } from '../controllers/schedule.controller';

const router = Router();

const scheduleRepo = new ScheduleRepository();
const routeRepo = new RouteRepository();
const routeStopRepo = new RouteStopRepository();
const routeStopEnrichment = new RouteStopEnrichmentService(routeStopRepo);
const storeRepo = new StoreRepository();
const userRepo = new UserRepository();
const teamRepo = new TeamRepository();

const controller = new ScheduleController(
  new CreateScheduleUseCase(scheduleRepo, storeRepo),
  new ListSchedulesUseCase(scheduleRepo, storeRepo, routeRepo, userRepo),
  new GetScheduleUseCase(
    scheduleRepo,
    storeRepo,
    routeRepo,
    userRepo,
    teamRepo,
    routeStopEnrichment
  ),
  new UpdateScheduleUseCase(scheduleRepo, storeRepo, routeRepo),
  new DeleteScheduleUseCase(scheduleRepo, routeRepo, routeStopRepo)
);

router.post('/', dispatchOpsGuard, controller.create);
router.get('/', scheduleViewerGuard, controller.list);
router.get('/:id', scheduleViewerGuard, controller.getById);
router.put('/:id', dispatchOpsGuard, controller.update);
router.delete('/:id', dispatchOpsGuard, controller.delete);

export default router;
