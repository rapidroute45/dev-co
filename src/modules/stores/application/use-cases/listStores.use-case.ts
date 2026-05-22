import { IStoreRepository, StoreListFilters } from '../../domain/interfaces/store-repository.interface';
import { mapStoreToResponse } from '../mappers/storeResponse.mapper';

export class ListStoresUseCase {
  constructor(private storeRepo: IStoreRepository) {}

  async execute(query: Record<string, string>) {
    const filters: StoreListFilters = {
      city: query.city,
      state: query.state,
      search: query.search,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    if (query.activeStatus) {
      filters.activeStatus = query.activeStatus as StoreListFilters['activeStatus'];
    }

    const { items, total } = await this.storeRepo.findMany(filters);
    return {
      items: items.map(mapStoreToResponse),
      total,
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
    };
  }
}
