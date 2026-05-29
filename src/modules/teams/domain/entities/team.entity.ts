export interface TeamProps {
  id?: string;
  name: string;
  code: string;
  teamNumber: number;
  teamLeadId?: string | null;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Team {
  constructor(private props: TeamProps) {}

  get id() {
    return this.props.id;
  }
  get name() {
    return this.props.name;
  }
  get code() {
    return this.props.code;
  }
  get teamNumber() {
    return this.props.teamNumber;
  }
  get teamLeadId() {
    return this.props.teamLeadId;
  }
  get createdBy() {
    return this.props.createdBy;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
