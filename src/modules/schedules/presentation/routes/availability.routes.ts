import { Router } from 'express';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { managerOrTeamLeadGuard } from '../../../../shared/middleware/managerOrTeamLeadGuard';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { TeamRepository } from '../../../teams/infrastructure/repositories/team.repository';
import { RouteRepository } from '../../infrastructure/repositories/route.repository';
import { AvailabilityService } from '../../application/services/availability.service';
import { AvailabilityController } from '../controllers/availability.controller';

const router = Router();
const controller = new AvailabilityController(
  new AvailabilityService(
    new TeamRepository(),
    new UserRepository(),
    new RouteRepository()
  )
);

router.get('/teams', managerGuard, controller.getTeams);
router.get('/drivers/:teamId', managerOrTeamLeadGuard, controller.getDriversByTeam);

export default router;
