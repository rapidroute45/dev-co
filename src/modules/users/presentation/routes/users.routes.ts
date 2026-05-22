import { Router } from 'express';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { TeamRepository } from '../../../teams/infrastructure/repositories/team.repository';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { ROLES_REQUIRING_TEAM } from '../../../../shared/constants/roleRequirements';
import { CreateUserUseCase } from '../../application/use-cases/createUser.use-case';
import { ListUsersUseCase } from '../../application/use-cases/listUsers.use-case';
import { GetUserUseCase } from '../../application/use-cases/getUser.use-case';
import { UpdateUserUseCase } from '../../application/use-cases/updateUser.use-case';
import { DeleteUserUseCase } from '../../application/use-cases/deleteUser.use-case';
import { UsersController } from '../controllers/users.controller';

const router = Router();
const userRepo = new UserRepository();
const teamRepo = new TeamRepository();

const controller = new UsersController(
  new CreateUserUseCase(userRepo, teamRepo),
  new ListUsersUseCase(userRepo, teamRepo),
  new GetUserUseCase(userRepo, teamRepo),
  new UpdateUserUseCase(userRepo, teamRepo),
  new DeleteUserUseCase(userRepo, teamRepo)
);

router.get('/roles-requiring-team', managerGuard, (_req: import('express').Request, res: import('express').Response) => {
  res.status(200).json({ success: true, data: ROLES_REQUIRING_TEAM });
});

router.post('/', managerGuard, controller.create);
router.get('/', managerGuard, controller.list);
router.get('/:userId', managerGuard, controller.getById);
router.patch('/:userId', managerGuard, controller.update);
router.delete('/:userId', managerGuard, controller.delete);

export default router;
