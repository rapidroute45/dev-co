import { AppError } from '../../../../shared/errors/app-error';
import { IStoreRepository } from '../../domain/interfaces/store-repository.interface';
import { mapStoreToResponse } from '../mappers/storeResponse.mapper';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';

export class GetStoreUseCase {
  constructor(private storeRepo: IStoreRepository) {}

  async execute(id: string, actor?: CityActor) {
    const store = await this.storeRepo.findById(id);
    if (!store) throw new AppError('Store not found.', 404);
    enforceActorCity(actor, store.city);
    return mapStoreToResponse(store);
  }
}
