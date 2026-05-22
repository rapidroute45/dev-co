import { ScheduleStatus } from '../../../../shared/constants/scheduleStatuses';
import { CreateStoreDTO } from '../../../stores/application/dto/create-store.dto';

export interface CreateScheduleDTO {
  date: string;
  city: string;
  state: string;
  storeId?: string;
  store?: CreateStoreDTO;
  status?: ScheduleStatus;
  notes?: string;
}
