import { Schedule } from '../../domain/entities/schedule.entity';
import {
  IScheduleRepository,
  ScheduleListFilters,
  ScheduleUpdateData,
} from '../../domain/interfaces/schedule-repository.interface';
import { ScheduleModel } from '../models/schedule.model';
import { ScheduleStatus } from '../../../../shared/constants/scheduleStatuses';
import { parseScheduleDate } from '../../application/utils/scheduleDate';

function mapDoc(doc: {
  _id: { toString(): string };
  date: Date;
  city: string;
  state: string;
  storeId: { toString(): string };
  createdBy: { toString(): string };
  status: string;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}): Schedule {
  return new Schedule({
    id: doc._id.toString(),
    date: doc.date,
    city: doc.city,
    state: doc.state,
    storeId: doc.storeId.toString(),
    createdBy: doc.createdBy.toString(),
    status: doc.status as ScheduleStatus,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

function buildQuery(filters?: ScheduleListFilters) {
  const query: Record<string, unknown> = {};
  if (filters?.date) query.date = parseScheduleDate(filters.date);
  if (filters?.city) query.city = new RegExp(filters.city.trim(), 'i');
  if (filters?.state) query.state = new RegExp(filters.state.trim(), 'i');
  if (filters?.storeId) query.storeId = filters.storeId;
  if (filters?.status) query.status = filters.status;
  if (filters?.createdBy) query.createdBy = filters.createdBy;
  if (filters?.scheduleIds) query._id = { $in: filters.scheduleIds };
  return query;
}

export class ScheduleRepository implements IScheduleRepository {
  async findById(id: string): Promise<Schedule | null> {
    const doc = await ScheduleModel.findById(id);
    return doc ? mapDoc(doc) : null;
  }

  async findMany(filters?: ScheduleListFilters): Promise<{ items: Schedule[]; total: number }> {
    const query = buildQuery(filters);
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 20));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      ScheduleModel.find(query).sort({ date: 1 }).skip(skip).limit(limit),
      ScheduleModel.countDocuments(query),
    ]);

    return { items: docs.map(mapDoc), total };
  }

  async save(schedule: Schedule): Promise<Schedule> {
    const created = await ScheduleModel.create({
      date: schedule.date,
      city: schedule.city,
      state: schedule.state,
      storeId: schedule.storeId,
      createdBy: schedule.createdBy,
      status: schedule.status,
      notes: schedule.notes,
    });
    return mapDoc(created);
  }

  async update(id: string, data: ScheduleUpdateData): Promise<Schedule | null> {
    const patch: Record<string, unknown> = {};
    if (data.date !== undefined) patch.date = data.date;
    if (data.city !== undefined) patch.city = data.city.trim();
    if (data.state !== undefined) patch.state = data.state.trim();
    if (data.storeId !== undefined) patch.storeId = data.storeId;
    if (data.status !== undefined) patch.status = data.status;
    if (data.notes !== undefined) patch.notes = data.notes;

    const doc = await ScheduleModel.findByIdAndUpdate(id, patch, {
      returnDocument: 'after',
    });
    return doc ? mapDoc(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await ScheduleModel.findByIdAndDelete(id);
    return result != null;
  }
}
