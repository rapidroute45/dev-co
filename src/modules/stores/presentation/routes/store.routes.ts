import { Router } from 'express';
import { managerGuard } from '../../../../shared/middleware/managerGuard';
import { requireDispatchElevation } from '../../../../shared/middleware/opsElevation.middleware';
import { scheduleViewerGuard } from '../../../../shared/middleware/scheduleViewerGuard';
import { StoreRepository } from '../../infrastructure/repositories/store.repository';
import { CreateStoreUseCase } from '../../application/use-cases/createStore.use-case';
import { ListStoresUseCase } from '../../application/use-cases/listStores.use-case';
import { GetStoreUseCase } from '../../application/use-cases/getStore.use-case';
import { UpdateStoreUseCase } from '../../application/use-cases/updateStore.use-case';
import { StoreController } from '../controllers/store.controller';

const router = Router();
const storeRepo = new StoreRepository();

const controller = new StoreController(
  new CreateStoreUseCase(storeRepo),
  new ListStoresUseCase(storeRepo),
  new GetStoreUseCase(storeRepo),
  new UpdateStoreUseCase(storeRepo)
);

router.post('/', [...managerGuard, requireDispatchElevation], controller.create);
router.get('/', scheduleViewerGuard, controller.list);
router.get('/:id', scheduleViewerGuard, controller.getById);
router.put('/:id', [...managerGuard, requireDispatchElevation], controller.update);

export default router;
