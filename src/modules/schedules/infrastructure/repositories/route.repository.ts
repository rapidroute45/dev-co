import { Route } from '../../domain/entities/route.entity';
import {
  IRouteRepository,
  RouteListFilters,
  RouteUpdateData,
} from '../../domain/interfaces/route-repository.interface';
import { parseScheduleDate } from '../../application/utils/scheduleDate';
import { RouteModel } from '../models/route.model';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { DeliveryVerification } from '../../../../shared/constants/deliveryVerification';
import { ROUTE_ACTIVE_STATUSES } from '../../../../shared/constants/routeStatuses';

function mapDoc(doc: {
  _id: { toString(): string };
  scheduleId: { toString(): string };
  scheduleDate: Date;
  teamId: { toString(): string };
  driverId?: { toString(): string } | null;
  routeName?: string | null;
  location?: string | null;
  vehicleType?: string | null;
  mileage?: number | null;
  stops?: number | null;
  arrivalTime: string;
  departureTime: string;
  arrivalMinutes: number;
  departureMinutes: number;
  status: string;
  assignedBy: { toString(): string };
  notes?: string | null;
  totalMiles?: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
  driverLocationAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  deliveryVerification?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}): Route {
  return new Route({
    id: doc._id.toString(),
    scheduleId: doc.scheduleId.toString(),
    scheduleDate: doc.scheduleDate,
    teamId: doc.teamId.toString(),
    driverId: doc.driverId?.toString() ?? null,
    routeName: doc.routeName ?? null,
    location: doc.location ?? null,
    vehicleType: doc.vehicleType ?? null,
    mileage: doc.mileage ?? null,
    stops: doc.stops ?? null,
    arrivalTime: doc.arrivalTime,
    departureTime: doc.departureTime,
    arrivalMinutes: doc.arrivalMinutes,
    departureMinutes: doc.departureMinutes,
    status: doc.status as RouteStatus,
    assignedBy: doc.assignedBy.toString(),
    notes: doc.notes ?? null,
    totalMiles: doc.totalMiles ?? null,
    driverLat: doc.driverLat ?? null,
    driverLng: doc.driverLng ?? null,
    driverLocationAt: doc.driverLocationAt ?? null,
    startedAt: doc.startedAt ?? null,
    completedAt: doc.completedAt ?? null,
    deliveryVerification: (doc.deliveryVerification as DeliveryVerification) ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class RouteRepository implements IRouteRepository {
  async findById(id: string): Promise<Route | null> {
    const doc = await RouteModel.findById(id);
    return doc ? mapDoc(doc) : null;
  }

  async findMany(filters: RouteListFilters): Promise<{ items: Route[]; total: number }> {
    const query: Record<string, unknown> = {
      scheduleDate: parseScheduleDate(filters.date),
    };
    if (filters.status) query.status = filters.status;
    if (filters.teamId) query.teamId = filters.teamId;
    if (filters.scheduleIds?.length) {
      query.scheduleId = { $in: filters.scheduleIds };
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      RouteModel.find(query).sort({ arrivalMinutes: 1 }).skip(skip).limit(limit),
      RouteModel.countDocuments(query),
    ]);

    return { items: docs.map(mapDoc), total };
  }

  async findManyByScheduleId(scheduleId: string): Promise<Route[]> {
    const docs = await RouteModel.find({ scheduleId }).sort({ arrivalMinutes: 1 });
    return docs.map(mapDoc);
  }

  async countByScheduleId(scheduleId: string): Promise<number> {
    return RouteModel.countDocuments({ scheduleId });
  }

  /** Routes not yet accepted (unassigned or offer awaiting driver). */
  async countPendingRoutesByScheduleId(scheduleId: string): Promise<number> {
    return RouteModel.countDocuments({
      scheduleId,
      status: { $in: [RouteStatus.PENDING, RouteStatus.ASSIGNED] },
    });
  }

  async countByScheduleDate(scheduleDate: Date, status?: RouteStatus): Promise<number> {
    const query: Record<string, unknown> = { scheduleDate };
    if (status) query.status = status;
    return RouteModel.countDocuments(query);
  }

  async countByTeamAndScheduleDate(
    teamId: string,
    scheduleDate: Date,
    status?: RouteStatus
  ): Promise<number> {
    const query: Record<string, unknown> = { teamId, scheduleDate };
    if (status) query.status = status;
    return RouteModel.countDocuments(query);
  }

  /** Drivers assigned to a route on this date (offer sent, active, or in progress). */
  async findBusyDriverIdsOnDate(scheduleDate: Date): Promise<string[]> {
    const ids = await RouteModel.distinct('driverId', {
      scheduleDate,
      driverId: { $ne: null },
      $or: [
        { status: { $in: [RouteStatus.ASSIGNED, RouteStatus.ACTIVE, RouteStatus.IN_PROGRESS] } },
        { status: RouteStatus.PENDING },
      ],
    });
    return ids
      .map((id) => (id == null ? null : String(id)))
      .filter((id): id is string => Boolean(id));
  }

  async findPendingOffersForDriver(driverId: string): Promise<Route[]> {
    const docs = await RouteModel.find({
      driverId,
      status: { $in: [RouteStatus.PENDING, RouteStatus.ASSIGNED] },
    }).sort({ scheduleDate: 1, arrivalMinutes: 1 });
    return docs.map(mapDoc);
  }

  async findManyByDriverId(
    driverId: string,
    filters?: { fromDate?: Date; toDate?: Date }
  ): Promise<Route[]> {
    const query: Record<string, unknown> = { driverId };
    if (filters?.fromDate || filters?.toDate) {
      query.scheduleDate = {};
      if (filters.fromDate) (query.scheduleDate as Record<string, Date>).$gte = filters.fromDate;
      if (filters.toDate) (query.scheduleDate as Record<string, Date>).$lte = filters.toDate;
    }
    const docs = await RouteModel.find(query).sort({ scheduleDate: 1, arrivalMinutes: 1 });
    return docs.map(mapDoc);
  }

  async findCompletedByDriverId(
    driverId: string,
    filters?: { fromDate?: Date; toDate?: Date }
  ): Promise<Route[]> {
    const query: Record<string, unknown> = {
      driverId,
      status: RouteStatus.COMPLETED,
    };
    if (filters?.fromDate || filters?.toDate) {
      query.scheduleDate = {};
      if (filters.fromDate) (query.scheduleDate as Record<string, Date>).$gte = filters.fromDate;
      if (filters.toDate) (query.scheduleDate as Record<string, Date>).$lte = filters.toDate;
    }
    const docs = await RouteModel.find(query).sort({ scheduleDate: -1, arrivalMinutes: 1 });
    return docs.map(mapDoc);
  }

  async findCompletedByTeamInRange(
    teamId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Route[]> {
    const docs = await RouteModel.find({
      teamId,
      status: RouteStatus.COMPLETED,
      driverId: { $ne: null },
      scheduleDate: { $gte: fromDate, $lte: toDate },
    }).sort({ scheduleDate: 1, arrivalMinutes: 1 });
    return docs.map(mapDoc);
  }

  async findCompletedByTeamExcludingRouteIds(
    teamId: string,
    excludeRouteIds: string[]
  ): Promise<Route[]> {
    const query: Record<string, unknown> = {
      teamId,
      status: RouteStatus.COMPLETED,
      driverId: { $ne: null },
    };
    if (excludeRouteIds.length > 0) {
      query._id = { $nin: excludeRouteIds };
    }
    const docs = await RouteModel.find(query).sort({ scheduleDate: 1, arrivalMinutes: 1 });
    return docs.map(mapDoc);
  }

  async findOverlappingForDriver(params: {
    driverId: string;
    scheduleDate: Date;
    arrivalMinutes: number;
    departureMinutes: number;
    excludeRouteId?: string;
  }): Promise<Route[]> {
    const query: Record<string, unknown> = {
      driverId: params.driverId,
      scheduleDate: params.scheduleDate,
      status: { $in: ROUTE_ACTIVE_STATUSES },
      arrivalMinutes: { $lt: params.departureMinutes },
      departureMinutes: { $gt: params.arrivalMinutes },
    };
    if (params.excludeRouteId) {
      query._id = { $ne: params.excludeRouteId };
    }

    const docs = await RouteModel.find(query);
    return docs.map(mapDoc);
  }

  async save(route: Route): Promise<Route> {
    const created = await RouteModel.create({
      scheduleId: route.scheduleId,
      scheduleDate: route.scheduleDate,
      teamId: route.teamId,
      driverId: route.driverId,
      routeName: route.routeName,
      location: route.location,
      vehicleType: route.vehicleType,
      mileage: route.mileage,
      stops: route.stops,
      arrivalTime: route.arrivalTime,
      departureTime: route.departureTime,
      arrivalMinutes: route.arrivalMinutes,
      departureMinutes: route.departureMinutes,
      status: route.status,
      assignedBy: route.assignedBy,
      notes: route.notes,
    });
    return mapDoc(created);
  }

  async update(id: string, data: RouteUpdateData): Promise<Route | null> {
    const patch: Record<string, unknown> = { ...data };
    const doc = await RouteModel.findByIdAndUpdate(id, patch, {
      returnDocument: 'after',
    });
    return doc ? mapDoc(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await RouteModel.findByIdAndDelete(id);
    return result != null;
  }

  async deleteManyByScheduleId(scheduleId: string): Promise<number> {
    const result = await RouteModel.deleteMany({ scheduleId });
    return result.deletedCount ?? 0;
  }
}
