import { Request, Response, NextFunction } from 'express';
import { CreateStoreUseCase } from '../../application/use-cases/createStore.use-case';
import { ListStoresUseCase } from '../../application/use-cases/listStores.use-case';
import { GetStoreUseCase } from '../../application/use-cases/getStore.use-case';
import { UpdateStoreUseCase } from '../../application/use-cases/updateStore.use-case';

export class StoreController {
  constructor(
    private createStoreUseCase: CreateStoreUseCase,
    private listStoresUseCase: ListStoresUseCase,
    private getStoreUseCase: GetStoreUseCase,
    private updateStoreUseCase: UpdateStoreUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.createStoreUseCase.execute(req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Store created successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.listStoresUseCase.execute(
        req.query as Record<string, string>,
        req.user
      );
      res.status(200).json({
        success: true,
        data: result.items,
        count: result.items.length,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.getStoreUseCase.execute(String(req.params.id), req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.updateStoreUseCase.execute(
        String(req.params.id),
        req.body,
        req.user
      );
      res.status(200).json({
        success: true,
        message: 'Store updated successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
