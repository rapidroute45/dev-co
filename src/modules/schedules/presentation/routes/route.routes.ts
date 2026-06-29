import { Router } from 'express';
import { dispatchOpsGuard } from '../../../../shared/middleware/dispatchOpsGuard';
import { scheduleViewerGuard } from '../../../../shared/middleware/scheduleViewerGuard';
import { trackingViewerGuard } from '../../../../shared/middleware/trackingViewerGuard';
import { driverGuard } from '../../../../shared/middleware/driverGuard';
import { teamLeadGuard } from '../../../../shared/middleware/teamLeadGuard';
import { requireDispatchElevation } from '../../../../shared/middleware/opsElevation.middleware';
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
import { RouteValidationService } from '../../application/services/routeValidation.service';
import { ScheduleActivationService } from '../../application/services/scheduleActivation.service';
import { RouteAutoCompleteService } from '../../application/services/routeAutoComplete.service';
import { DriverLocationMonitorService } from '../../application/services/driverLocationMonitor.service';
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
import { GetRouteTrackingUseCase } from '../../application/use-cases/getRouteTracking.use-case';
import { ListLiveRoutesUseCase } from '../../application/use-cases/listLiveRoutes.use-case';
import { RouteController } from '../controllers/route.controller';
import { TeamLeadScheduleAlertRepository } from '../../infrastructure/repositories/teamLeadScheduleAlert.repository';
import { TeamLeadScheduleAlertService } from '../../application/services/teamLeadScheduleAlert.service';

const router = Router();

const scheduleRepo = new ScheduleRepository();
const routeRepo = new RouteRepository();
const routeStopRepo = new RouteStopRepository();
const routeStopEnrichment = new RouteStopEnrichmentService(routeStopRepo);
const addressCodeRepo = new AddressAccessCodeRepository();
const storeRepo = new StoreRepository();
const userRepo = new UserRepository();
const teamRepo = new TeamRepository();
const notificationRepo = new NotificationRepository();
const notificationService = new NotificationService(notificationRepo);
const routeAutoComplete = new RouteAutoCompleteService(routeRepo, routeStopRepo);
const locationMonitor = new DriverLocationMonitorService(
  routeRepo,
  routeStopRepo,
  userRepo,
  routeAutoComplete,
  notificationService
);

const routeValidation = new RouteValidationService(
  scheduleRepo,
  teamRepo,
  userRepo,
  routeRepo
);
const scheduleActivation = new ScheduleActivationService(scheduleRepo, routeRepo);
const teamLeadAlertRepo = new TeamLeadScheduleAlertRepository();
const teamLeadAlertService = new TeamLeadScheduleAlertService(
  teamLeadAlertRepo,
  scheduleRepo,
  routeRepo,
  storeRepo,
  teamRepo,
  notificationService
);
const routeDelivery = new RouteDeliveryUseCase(
  routeRepo,
  routeStopRepo,
  addressCodeRepo,
  routeStopEnrichment,
  routeAutoComplete,
  scheduleRepo,
  locationMonitor
);

const getRouteTracking = new GetRouteTrackingUseCase(
  routeRepo,
  routeStopRepo,
  scheduleRepo,
  storeRepo,
  userRepo,
  teamRepo,
  routeStopEnrichment
);

const listLiveRoutes = new ListLiveRoutesUseCase(
  routeRepo,
  scheduleRepo,
  storeRepo,
  userRepo,
  teamRepo,
  routeStopEnrichment
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
    addressCodeRepo,
    teamLeadAlertService,
    userRepo
  ),
  new GetRouteUseCase(
    routeRepo,
    scheduleRepo,
    storeRepo,
    userRepo,
    teamRepo,
    routeStopEnrichment
  ),
  new UpdateRouteUseCase(
    routeRepo,
    routeStopRepo,
    routeValidation,
    notificationService,
    teamRepo,
    storeRepo,
    scheduleActivation,
    routeStopEnrichment,
    addressCodeRepo,
    userRepo,
    teamLeadAlertService,
    routeAutoComplete
  ),
  new DeleteRouteUseCase(
    routeRepo,
    routeStopRepo,
    scheduleRepo,
    teamLeadAlertService
  ),
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
  new ListRoutesUseCase(
    routeRepo,
    scheduleRepo,
    storeRepo,
    userRepo,
    teamRepo,
    teamLeadAlertService
  ),
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
  routeDelivery,
  getRouteTracking,
  listLiveRoutes
);

router.get('/offers/pending', driverGuard, controller.listPendingOffers);
router.get('/me', driverGuard, controller.listMyRoutes);
router.get('/me/completed', driverGuard, controller.listMyCompletedRoutes);
router.get('/', scheduleViewerGuard, controller.list);
router.post('/', [...dispatchOpsGuard, requireDispatchElevation], controller.create);
router.get('/live', trackingViewerGuard, controller.listLive);
router.get('/:id/tracking', trackingViewerGuard, controller.getTracking);
router.get('/:id', scheduleViewerGuard, controller.getById);
router.put('/:id', [...dispatchOpsGuard, requireDispatchElevation], controller.update);
router.post('/:id/assign-driver', teamLeadGuard, controller.assignDriver);
router.post('/:id/accept', driverGuard, controller.accept);
router.post('/:id/decline', driverGuard, controller.decline);
router.post('/:id/start', driverGuard, controller.startRoute);
router.post('/:id/location', driverGuard, controller.reportLocation);
router.post('/:id/location/batch', driverGuard, controller.reportLocationBatch);
router.post('/:id/complete', driverGuard, controller.completeRoute);
router.post('/:routeId/stops/:stopId/complete', driverGuard, controller.completeStop);
router.post('/:routeId/stops/:stopId/return', driverGuard, controller.returnStop);
router.post('/:routeId/stops/:stopId/ops-complete', [...dispatchOpsGuard, requireDispatchElevation], controller.opsCompleteStop);
router.post('/:routeId/stops/:stopId/ops-return', [...dispatchOpsGuard, requireDispatchElevation], controller.opsReturnStop);
router.patch('/:routeId/stops/:stopId/status', [...dispatchOpsGuard, requireDispatchElevation], controller.opsUpdateStopStatus);
router.put('/:routeId/stops/:stopId/access-code', [...dispatchOpsGuard, requireDispatchElevation], controller.setAccessCode);
router.delete('/:id', [...dispatchOpsGuard, requireDispatchElevation], controller.delete);

export default router;
