import { Store } from '../../domain/entities/store.entity';

export function mapStoreToResponse(store: Store) {
  return {
    id: store.id!,
    storeName: store.storeName,
    storeId: store.storeId,
    city: store.city,
    state: store.state,
    address: store.address,
    activeStatus: store.activeStatus,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  };
}
