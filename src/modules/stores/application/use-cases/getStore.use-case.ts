import { AppError } from '../../../../shared/errors/app-error';
import { IStoreRepository } from '../../domain/interfaces/store-repository.interface';
import { mapStoreToResponse } from '../mappers/storeResponse.mapper';

export class GetStoreUseCase {
  constructor(private storeRepo: IStoreRepository) {}

  async execute(id: string) {
    const store = await this.storeRepo.findById(id);
    if (!store) throw new AppError('Store not found.', 404);
    return mapStoreToResponse(store);
  }
}
