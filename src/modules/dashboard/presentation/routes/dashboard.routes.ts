import { Router } from 'express';
import { dispatchOpsGuard } from '../../../../shared/middleware/dispatchOpsGuard';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { teamLeadGuard } from '../../../../shared/middleware/teamLeadGuard';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { TeamRepository } from '../../../teams/infrastructure/repositories/team.repository';
import { RouteRepository } from '../../../schedules/infrastructure/repositories/route.repository';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { ManagerDashboardService } from '../../application/services/managerDashboard.service';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();
const service = new ManagerDashboardService(
  new RouteRepository(),
  new ScheduleRepository(),
  new UserRepository(),
  new TeamRepository()
);

const controller = new DashboardController(service);

router.get('/stats', dispatchOpsGuard, controller.getStats);
router.get('/available-drivers', managerGuard, controller.listAvailableDrivers);

router.get('/team/stats', teamLeadGuard, controller.getTeamStats);
router.get('/team/available-drivers', teamLeadGuard, controller.listTeamAvailableDrivers);

export default router;
