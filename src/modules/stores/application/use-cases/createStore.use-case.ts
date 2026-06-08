import { AppError } from '../../../../shared/errors/app-error';
import { StoreActiveStatus } from '../../../../shared/constants/storeStatuses';
import { Store } from '../../domain/entities/store.entity';
import { IStoreRepository } from '../../domain/interfaces/store-repository.interface';
import { CreateStoreDTO } from '../dto/create-store.dto';
import { buildStoreIdPrefix, formatStoreId } from '../utils/generateStoreId';
import { mapStoreToResponse } from '../mappers/storeResponse.mapper';
import { CityActor, enforceActorCity } from '../../../../shared/services/cityScope.service';

export class CreateStoreUseCase {
  constructor(private storeRepo: IStoreRepository) {}

  async execute(dto: CreateStoreDTO, actor?: CityActor) {
    const storeName = dto.storeName?.trim();
    const city = dto.city?.trim();
    const state = dto.state?.trim();

    if (city) enforceActorCity(actor, city);

    if (!storeName || storeName.length < 2) {
      throw new AppError('Store name must be at least 2 characters.', 400);
    }
    if (!city) throw new AppError('City is required.', 400);
    if (!state) throw new AppError('State is required.', 400);

    const address = dto.address?.trim();
    if (!address) throw new AppError('Address is required.', 400);

    const prefix = buildStoreIdPrefix(storeName);
    const count = await this.storeRepo.countByStoreIdPrefix(prefix);
    const storeId = formatStoreId(prefix, count + 1);

    const collision = await this.storeRepo.findByStoreId(storeId);
    if (collision) {
      throw new AppError('Store ID collision. Please try again.', 409);
    }

    const store = new Store({
      storeName,
      storeId,
      city,
      state,
      address,
      activeStatus: StoreActiveStatus.ACTIVE,
    });

    const saved = await this.storeRepo.save(store);
    return mapStoreToResponse(saved);
  }
}
