export interface InvoiceBillToProps {
  id?: string;
  name: string;
  address: string;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class InvoiceBillTo {
  constructor(private props: InvoiceBillToProps) {}

  get id() {
    return this.props.id;
  }
  get name() {
    return this.props.name;
  }
  get address() {
    return this.props.address;
  }
  get updatedBy() {
    return this.props.updatedBy ?? null;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
