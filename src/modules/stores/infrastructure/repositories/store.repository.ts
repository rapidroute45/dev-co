import { Store } from '../../domain/entities/store.entity';
import {
  IStoreRepository,
  StoreListFilters,
  StoreUpdateData,
} from '../../domain/interfaces/store-repository.interface';
import { StoreModel } from '../models/store.model';
import { StoreActiveStatus } from '../../../../shared/constants/storeStatuses';
import { applyCityListFilter } from '../../../../shared/services/cityScope.service';

function mapDoc(doc: {
  _id: { toString(): string };
  storeName: string;
  storeId: string;
  city: string;
  state: string;
  address?: string | null;
  activeStatus: string;
  createdAt?: Date;
  updatedAt?: Date;
}): Store {
  return new Store({
    id: doc._id.toString(),
    storeName: doc.storeName,
    storeId: doc.storeId,
    city: doc.city,
    state: doc.state,
    address: doc.address ?? null,
    activeStatus: doc.activeStatus as StoreActiveStatus,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

function buildQuery(filters?: StoreListFilters) {
  const query: Record<string, unknown> = {};
  applyCityListFilter(query, { city: filters?.city, cities: filters?.cities });
  if (filters?.state) query.state = new RegExp(filters.state.trim(), 'i');
  if (filters?.activeStatus) query.activeStatus = filters.activeStatus;
  if (filters?.search?.trim()) {
    const term = filters.search.trim();
    query.$or = [
      { storeName: { $regex: term, $options: 'i' } },
      { storeId: { $regex: term, $options: 'i' } },
      { city: { $regex: term, $options: 'i' } },
    ];
  }
  return query;
}

export class StoreRepository implements IStoreRepository {
  async findById(id: string): Promise<Store | null> {
    const doc = await StoreModel.findById(id);
    return doc ? mapDoc(doc) : null;
  }

  async findByStoreId(storeId: string): Promise<Store | null> {
    const doc = await StoreModel.findOne({ storeId: storeId.toUpperCase().trim() });
    return doc ? mapDoc(doc) : null;
  }

  async findMany(filters?: StoreListFilters): Promise<{ items: Store[]; total: number }> {
    const query = buildQuery(filters);
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 50));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      StoreModel.find(query).sort({ storeName: 1 }).skip(skip).limit(limit),
      StoreModel.countDocuments(query),
    ]);

    return { items: docs.map(mapDoc), total };
  }

  async countByStoreIdPrefix(prefix: string): Promise<number> {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return StoreModel.countDocuments({ storeId: new RegExp(`^${escaped}-`, 'i') });
  }

  async save(store: Store): Promise<Store> {
    const created = await StoreModel.create({
      storeName: store.storeName,
      storeId: store.storeId,
      city: store.city,
      state: store.state,
      address: store.address,
      activeStatus: store.activeStatus,
    });
    return mapDoc(created);
  }

  async update(id: string, data: StoreUpdateData): Promise<Store | null> {
    const patch: Record<string, unknown> = {};
    if (data.storeName !== undefined) patch.storeName = data.storeName;
    if (data.city !== undefined) patch.city = data.city;
    if (data.state !== undefined) patch.state = data.state;
    if (data.address !== undefined) patch.address = data.address;
    if (data.activeStatus !== undefined) patch.activeStatus = data.activeStatus;

    const doc = await StoreModel.findByIdAndUpdate(id, patch, {
      returnDocument: 'after',
    });
    return doc ? mapDoc(doc) : null;
  }
}
