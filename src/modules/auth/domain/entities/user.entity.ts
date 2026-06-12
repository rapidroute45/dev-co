import { UserRole, UserStatus } from '../../../../shared/constants/roles';

export interface UserProps {
  id?: string;
  email: string;
  passwordHash: string;
  fullName?: string | null;
  phone?: string | null;
  role: UserRole | null;
  status: UserStatus;
  teamId?: string | null;
  assignedCity?: string | null;
  assignedCities?: string[] | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  private props: UserProps;

  constructor(props: UserProps) {
    this.props = {
      ...props,
      status: props.status ?? UserStatus.PENDING,
      role: props.role ?? null,
      fullName: props.fullName ?? null,
      phone: props.phone ?? null,
    };
  }

  get id() { return this.props.id; }
  get email() { return this.props.email; }
  get passwordHash() { return this.props.passwordHash; }
  get fullName() { return this.props.fullName ?? null; }
  get phone() { return this.props.phone ?? null; }
  get role() { return this.props.role; }
  get status() { return this.props.status; }
  get teamId() { return this.props.teamId ?? null; }
  get assignedCity() { return this.props.assignedCity ?? null; }
  get assignedCities() { return this.props.assignedCities ?? []; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  public isApproved(): boolean {
    return this.props.status === UserStatus.ACTIVE;
  }

  public hasAssignedRole(): boolean {
    return this.props.role != null;
  }
}
