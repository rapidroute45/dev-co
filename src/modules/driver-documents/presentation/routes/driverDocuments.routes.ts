import { Router } from 'express';
import { driverGuard } from '../../../../shared/middleware/driverGuard';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { scheduleViewerGuard } from '../../../../shared/middleware/scheduleViewerGuard';
import { uploadMiddleware } from '../../../../shared/upload/upload.config';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { NotificationRepository } from '../../../notifications/infrastructure/repositories/notification.repository';
import { DriverDocumentsService } from '../../application/services/driverDocuments.service';
import { DriverDocumentsController } from '../controllers/driverDocuments.controller';

const router = Router();
const service = new DriverDocumentsService(new UserRepository(), new NotificationRepository());
const controller = new DriverDocumentsController(service);

router.get('/requirements', scheduleViewerGuard, controller.listRequirements);
router.post('/requirements', managerGuard, controller.createRequirement);
router.put('/requirements/:requirementId', managerGuard, controller.updateRequirement);
router.delete('/requirements/:requirementId', managerGuard, controller.deleteRequirement);

router.get('/me', driverGuard, controller.getMyDocuments);
router.patch('/me/vehicle', driverGuard, controller.updateVehiclePlate);
router.post(
  '/me/vehicle',
  driverGuard,
  uploadMiddleware.single('vehiclePhoto'),
  controller.updateVehicle
);
router.post(
  '/me/:requirementId/upload',
  driverGuard,
  uploadMiddleware.single('file'),
  controller.uploadDocument
);

router.get('/drivers', managerGuard, controller.listDrivers);
router.get('/drivers/:driverId', managerGuard, controller.getDriverDocuments);
router.post(
  '/drivers/:driverId/:requirementId/verify',
  managerGuard,
  controller.verifyDocument
);
router.post(
  '/drivers/:driverId/:requirementId/reject',
  managerGuard,
  controller.rejectDocument
);

export default router;
