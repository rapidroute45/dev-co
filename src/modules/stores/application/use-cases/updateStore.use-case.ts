import { AppError } from '../../../../shared/errors/app-error';
import { STORE_ACTIVE_STATUSES, StoreActiveStatus } from '../../../../shared/constants/storeStatuses';
import { IStoreRepository } from '../../domain/interfaces/store-repository.interface';
import { mapStoreToResponse } from '../mappers/storeResponse.mapper';
import { UpdateStoreDTO } from '../dto/update-store.dto';

export class UpdateStoreUseCase {
  constructor(private storeRepo: IStoreRepository) {}

  async execute(id: string, dto: UpdateStoreDTO) {
    const existing = await this.storeRepo.findById(id);
    if (!existing) throw new AppError('Store not found.', 404);

    const patch: Parameters<IStoreRepository['update']>[1] = {};

    if (dto.storeName !== undefined) {
      const storeName = dto.storeName.trim();
      if (storeName.length < 2) {
        throw new AppError('Store name must be at least 2 characters.', 400);
      }
      patch.storeName = storeName;
    }
    if (dto.city !== undefined) {
      const city = dto.city.trim();
      if (!city) throw new AppError('City is required.', 400);
      patch.city = city;
    }
    if (dto.state !== undefined) {
      const state = dto.state.trim();
      if (!state) throw new AppError('State is required.', 400);
      patch.state = state.toUpperCase();
    }
    if (dto.address !== undefined) {
      const address = dto.address.trim();
      if (!address) throw new AppError('Address is required.', 400);
      patch.address = address;
    }
    if (dto.activeStatus !== undefined) {
      if (!STORE_ACTIVE_STATUSES.includes(dto.activeStatus)) {
        throw new AppError('Invalid store status.', 400);
      }
      patch.activeStatus = dto.activeStatus;
    }

    const updated = await this.storeRepo.update(id, patch);
    if (!updated) throw new AppError('Failed to update store.', 500);

    return mapStoreToResponse(updated);
  }
}
