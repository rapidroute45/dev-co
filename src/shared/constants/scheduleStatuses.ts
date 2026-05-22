export enum ScheduleStatus {
  DRAFT = 'draft',
  /** Published; waiting for driver(s) to accept route offers */
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export const SCHEDULE_STATUSES = Object.values(ScheduleStatus);
