import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { TeamRepository } from '../../../teams/infrastructure/repositories/team.repository';
import { requireAuth } from '../../../../shared/middleware/auth.middleware';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { GetPendingUsersUseCase } from '../../application/use-cases/GetPendingUsers.use-case';
import { GetCurrentUserUseCase } from '../../application/use-cases/getCurrentUser.use-case';
import { UpdateProfileUseCase } from '../../application/use-cases/updateProfile.use-case';

const router = Router();
const userRepo = new UserRepository();
const teamRepo = new TeamRepository();

const registerUseCase = new RegisterUseCase(userRepo);
const loginUseCase = new LoginUseCase(userRepo);
const getPendingUsersUseCase = new GetPendingUsersUseCase(userRepo);
const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepo, teamRepo);
const updateProfileUseCase = new UpdateProfileUseCase(userRepo, teamRepo);
const controller = new AuthController(
  registerUseCase,
  loginUseCase,
  getPendingUsersUseCase,
  getCurrentUserUseCase,
  updateProfileUseCase
);

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/me', requireAuth({ allowPending: true }), controller.me);
router.patch('/me', requireAuth({ allowPending: true }), controller.updateProfile);

/** @deprecated Use GET /api/v1/users?pending=true */
router.get('/pending', managerGuard, controller.getPending);

router.get('/verify-status', requireAuth(), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'If you see this, your account is active!',
    user: req.user,
  });
});

export default router;
