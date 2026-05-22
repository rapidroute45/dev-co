import { Store } from '../entities/store.entity';
import { StoreActiveStatus } from '../../../../shared/constants/storeStatuses';

export interface StoreListFilters {
  city?: string;
  state?: string;
  search?: string;
  activeStatus?: StoreActiveStatus;
  page?: number;
  limit?: number;
}

export interface StoreUpdateData {
  storeName?: string;
  city?: string;
  state?: string;
  address?: string | null;
  activeStatus?: StoreActiveStatus;
}

export interface IStoreRepository {
  findById(id: string): Promise<Store | null>;
  findByStoreId(storeId: string): Promise<Store | null>;
  findMany(filters?: StoreListFilters): Promise<{ items: Store[]; total: number }>;
  countByStoreIdPrefix(prefix: string): Promise<number>;
  save(store: Store): Promise<Store>;
  update(id: string, data: StoreUpdateData): Promise<Store | null>;
}
