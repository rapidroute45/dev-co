import { StoreActiveStatus } from '../../../../shared/constants/storeStatuses';

export interface UpdateStoreDTO {
  storeName?: string;
  city?: string;
  state?: string;
  address?: string;
  activeStatus?: StoreActiveStatus;
}
