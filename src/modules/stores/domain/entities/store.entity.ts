import { StoreActiveStatus } from '../../../../shared/constants/storeStatuses';

export interface StoreProps {
  id?: string;
  storeName: string;
  storeId: string;
  city: string;
  state: string;
  address?: string | null;
  activeStatus: StoreActiveStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Store {
  private props: StoreProps;

  constructor(props: StoreProps) {
    this.props = {
      ...props,
      address: props.address ?? null,
      activeStatus: props.activeStatus ?? StoreActiveStatus.ACTIVE,
    };
  }

  get id() {
    return this.props.id;
  }
  get storeName() {
    return this.props.storeName;
  }
  get storeId() {
    return this.props.storeId;
  }
  get city() {
    return this.props.city;
  }
  get state() {
    return this.props.state;
  }
  get address() {
    return this.props.address ?? null;
  }
  get activeStatus() {
    return this.props.activeStatus;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
