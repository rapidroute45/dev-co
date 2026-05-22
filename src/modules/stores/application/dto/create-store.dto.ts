import { StoreActiveStatus } from '../../../../shared/constants/storeStatuses';

export interface CreateStoreDTO {
  storeName: string;
  city: string;
  state: string;
  address: string;
  activeStatus?: StoreActiveStatus;
}
