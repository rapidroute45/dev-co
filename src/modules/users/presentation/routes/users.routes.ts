import { Router } from 'express';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { TeamRepository } from '../../../teams/infrastructure/repositories/team.repository';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { RouteRepository } from '../../../schedules/infrastructure/repositories/route.repository';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { requireDispatchElevation } from '../../../../shared/middleware/opsElevation.middleware';
import { ROLES_REQUIRING_CITY, ROLES_REQUIRING_TEAM } from '../../../../shared/constants/roleRequirements';
import { CreateUserUseCase } from '../../application/use-cases/createUser.use-case';
import { ListUsersUseCase } from '../../application/use-cases/listUsers.use-case';
import { GetUserUseCase } from '../../application/use-cases/getUser.use-case';
import { UpdateUserUseCase } from '../../application/use-cases/updateUser.use-case';
import { DeleteUserUseCase } from '../../application/use-cases/deleteUser.use-case';
import { UsersController } from '../controllers/users.controller';
import { NotificationRepository } from '../../../notifications/infrastructure/repositories/notification.repository';
import { NotificationService } from '../../../notifications/application/services/notification.service';

const router = Router();
const userRepo = new UserRepository();
const teamRepo = new TeamRepository();
const scheduleRepo = new ScheduleRepository();
const routeRepo = new RouteRepository();
const notificationService = new NotificationService(new NotificationRepository());

const controller = new UsersController(
  new CreateUserUseCase(userRepo, teamRepo, notificationService),
  new ListUsersUseCase(userRepo, teamRepo, scheduleRepo, routeRepo),
  new GetUserUseCase(userRepo, teamRepo),
  new UpdateUserUseCase(userRepo, teamRepo, notificationService),
  new DeleteUserUseCase(userRepo, teamRepo)
);

router.get('/roles-requiring-team', managerGuard, (_req: import('express').Request, res: import('express').Response) => {
  res.status(200).json({ success: true, data: ROLES_REQUIRING_TEAM });
});

router.get('/roles-requiring-city', managerGuard, (_req: import('express').Request, res: import('express').Response) => {
  res.status(200).json({ success: true, data: ROLES_REQUIRING_CITY });
});

router.post('/', [...managerGuard, requireDispatchElevation], controller.create);
router.get('/', managerGuard, controller.list);
router.get('/:userId', managerGuard, controller.getById);
router.patch('/:userId', [...managerGuard, requireDispatchElevation], controller.update);
router.delete('/:userId', [...managerGuard, requireDispatchElevation], controller.delete);

export default router;
