import { Router } from 'express';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { scheduleViewerGuard } from '../../../../shared/middleware/scheduleViewerGuard';
import { driverGuard } from '../../../../shared/middleware/driverGuard';
import { teamLeadGuard } from '../../../../shared/middleware/teamLeadGuard';
import { uploadMiddleware } from '../../../../shared/upload/upload.config';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { TeamRepository } from '../../../teams/infrastructure/repositories/team.repository';
import { StoreRepository } from '../../../stores/infrastructure/repositories/store.repository';
import { NotificationRepository } from '../../../notifications/infrastructure/repositories/notification.repository';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { ScheduleRepository } from '../../infrastructure/repositories/schedule.repository';
import { RouteRepository } from '../../infrastructure/repositories/route.repository';
import { RouteStopRepository } from '../../infrastructure/repositories/routeStop.repository';
import { RouteStopEnrichmentService } from '../../application/services/routeStopEnrichment.service';
import { AddressAccessCodeRepository } from '../../infrastructure/repositories/addressAccessCode.repository';
import { DriverLocationRepository } from '../../infrastructure/repositories/driverLocation.repository';
import { RouteValidationService } from '../../application/services/routeValidation.service';
import { ScheduleActivationService } from '../../application/services/scheduleActivation.service';
import { RouteDeliveryUseCase } from '../../application/use-cases/routeDelivery.use-case';
import { CreateRouteUseCase } from '../../application/use-cases/createRoute.use-case';
import { GetRouteUseCase } from '../../application/use-cases/getRoute.use-case';
import { UpdateRouteUseCase } from '../../application/use-cases/updateRoute.use-case';
import { DeleteRouteUseCase } from '../../application/use-cases/deleteRoute.use-case';
import { AcceptRouteUseCase } from '../../application/use-cases/acceptRoute.use-case';
import { DeclineRouteUseCase } from '../../application/use-cases/declineRoute.use-case';
import { ListPendingRouteOffersUseCase } from '../../application/use-cases/listPendingRouteOffers.use-case';
import { ListRoutesUseCase } from '../../application/use-cases/listRoutes.use-case';
import { ListMyRoutesUseCase } from '../../application/use-cases/listMyRoutes.use-case';
import { ListMyCompletedRoutesUseCase } from '../../application/use-cases/listMyCompletedRoutes.use-case';
import { StartRouteUseCase } from '../../application/use-cases/startRoute.use-case';
import { RouteController } from '../controllers/route.controller';
import { chatService } from '../../../chat/presentation/routes/chat.routes';

const router = Router();

const scheduleRepo = new ScheduleRepository();
const routeRepo = new RouteRepository();
const routeStopRepo = new RouteStopRepository();
const routeStopEnrichment = new RouteStopEnrichmentService(routeStopRepo);
const addressCodeRepo = new AddressAccessCodeRepository();
const driverLocationRepo = new DriverLocationRepository();
const storeRepo = new StoreRepository();
const userRepo = new UserRepository();
const teamRepo = new TeamRepository();
const notificationService = new NotificationService(new NotificationRepository());

const routeValidation = new RouteValidationService(
  scheduleRepo,
  teamRepo,
  userRepo,
  routeRepo
);
const scheduleActivation = new ScheduleActivationService(scheduleRepo, routeRepo);
const routeDelivery = new RouteDeliveryUseCase(
  routeRepo,
  routeStopRepo,
  driverLocationRepo,
  addressCodeRepo,
  routeStopEnrichment,
  chatService
);

const controller = new RouteController(
  new CreateRouteUseCase(
    routeRepo,
    routeStopRepo,
    routeValidation,
    notificationService,
    storeRepo,
    teamRepo,
    scheduleActivation,
    routeStopEnrichment,
    addressCodeRepo
  ),
  new GetRouteUseCase(routeRepo, scheduleRepo, storeRepo, userRepo, teamRepo, routeStopEnrichment),
  new UpdateRouteUseCase(
    routeRepo,
    routeStopRepo,
    routeValidation,
    notificationService,
    teamRepo,
    storeRepo,
    scheduleActivation,
    routeStopEnrichment,
    addressCodeRepo
  ),
  new DeleteRouteUseCase(routeRepo, routeStopRepo, driverLocationRepo),
  new AcceptRouteUseCase(
    routeRepo,
    scheduleRepo,
    storeRepo,
    teamRepo,
    userRepo,
    scheduleActivation,
    routeStopEnrichment
  ),
  new DeclineRouteUseCase(routeRepo, teamRepo, scheduleActivation),
  new ListPendingRouteOffersUseCase(
    routeRepo,
    scheduleRepo,
    storeRepo,
    teamRepo,
    routeStopEnrichment
  ),
  new ListRoutesUseCase(routeRepo, scheduleRepo, storeRepo, userRepo, teamRepo),
  new ListMyRoutesUseCase(
    routeRepo,
    scheduleRepo,
    storeRepo,
    teamRepo,
    routeStopEnrichment
  ),
  new ListMyCompletedRoutesUseCase(routeRepo, scheduleRepo, storeRepo, teamRepo),
  new StartRouteUseCase(
    routeRepo,
    scheduleRepo,
    storeRepo,
    teamRepo,
    routeStopEnrichment
  ),
  routeDelivery
);

router.get('/offers/pending', driverGuard, controller.listPendingOffers);
router.get('/me', driverGuard, controller.listMyRoutes);
router.get('/me/completed', driverGuard, controller.listMyCompletedRoutes);
router.get('/', scheduleViewerGuard, controller.list);
router.post('/', managerGuard, controller.create);
router.get('/:id/tracking', scheduleViewerGuard, controller.getTracking);
router.get('/:id', scheduleViewerGuard, controller.getById);
router.put('/:id', managerGuard, controller.update);
router.post('/:id/assign-driver', teamLeadGuard, controller.assignDriver);
router.post('/:id/accept', driverGuard, controller.accept);
router.post('/:id/decline', driverGuard, controller.decline);
router.post('/:id/start', driverGuard, controller.startRoute);
router.post('/:id/complete', driverGuard, controller.completeRoute);
router.post('/:id/location', driverGuard, controller.reportLocation);
router.post(
  '/:routeId/stops/:stopId/complete',
  driverGuard,
  uploadMiddleware.single('proofPhoto'),
  controller.completeStop
);
router.post('/:routeId/stops/:stopId/return', driverGuard, controller.returnStop);
router.put('/:routeId/stops/:stopId/access-code', managerGuard, controller.setAccessCode);
router.delete('/:id', managerGuard, controller.delete);

export default router;
