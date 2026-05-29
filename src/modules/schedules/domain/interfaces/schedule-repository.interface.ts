import { Schedule } from '../entities/schedule.entity';
import { ScheduleStatus } from '../../../../shared/constants/scheduleStatuses';

export interface ScheduleListFilters {
  date?: string;
  city?: string;
  state?: string;
  storeId?: string;
  status?: ScheduleStatus;
  createdBy?: string;
  scheduleIds?: string[];
  page?: number;
  limit?: number;
}

export interface ScheduleUpdateData {
  date?: Date;
  city?: string;
  state?: string;
  storeId?: string;
  status?: ScheduleStatus;
  notes?: string | null;
}

export interface IScheduleRepository {
  findById(id: string): Promise<Schedule | null>;
  findMany(filters?: ScheduleListFilters): Promise<{ items: Schedule[]; total: number }>;
  save(schedule: Schedule): Promise<Schedule>;
  update(id: string, data: ScheduleUpdateData): Promise<Schedule | null>;
  delete(id: string): Promise<boolean>;
}
