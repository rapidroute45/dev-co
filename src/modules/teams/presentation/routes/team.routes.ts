import { Router } from 'express';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { TeamRepository } from '../../infrastructure/repositories/team.repository';
import { dispatchOpsGuard } from '../../../../shared/middleware/dispatchOpsGuard';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { requireDispatchElevation } from '../../../../shared/middleware/opsElevation.middleware';
import { CreateTeamUseCase } from '../../application/use-cases/createTeam.use-case';
import { ListTeamsUseCase } from '../../application/use-cases/listTeams.use-case';
import { GetTeamDetailUseCase } from '../../application/use-cases/getTeamDetail.use-case';
import { UpdateTeamUseCase } from '../../application/use-cases/updateTeam.use-case';
import { DeleteTeamUseCase } from '../../application/use-cases/deleteTeam.use-case';
import { TeamController } from '../controllers/team.controller';

const router = Router();
const teamRepo = new TeamRepository();
const userRepo = new UserRepository();

const controller = new TeamController(
  new CreateTeamUseCase(teamRepo),
  new ListTeamsUseCase(teamRepo, userRepo),
  new GetTeamDetailUseCase(teamRepo, userRepo),
  new UpdateTeamUseCase(teamRepo, userRepo),
  new DeleteTeamUseCase(teamRepo, userRepo)
);

router.post('/', [...managerGuard, requireDispatchElevation], controller.create);
router.get('/', dispatchOpsGuard, controller.list);
router.get('/:teamId', dispatchOpsGuard, controller.getById);
router.patch('/:teamId', [...managerGuard, requireDispatchElevation], controller.update);
router.delete('/:teamId', [...managerGuard, requireDispatchElevation], controller.delete);

export default router;
