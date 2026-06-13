import { Router } from 'express';
import { requireAuth } from '../../../../shared/middleware/auth.middleware';
import { requireRoles } from '../../../../shared/middleware/role.middleware';
import { UserRole } from '../../../../shared/constants/roles';
import { ListCitiesUseCase } from '../../application/use-cases/listCities.use-case';

const router = Router();
const listCitiesUseCase = new ListCitiesUseCase();

const cityListGuard = [
  requireAuth(),
  requireRoles(
    UserRole.ADMIN,
    UserRole.DISPATCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.TEAM_LEAD,
    UserRole.DISPATCH_TEAM
  ),
];

router.get('/', cityListGuard, async (_req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const data = await listCitiesUseCase.execute();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
