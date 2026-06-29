import { Types, type HydratedDocument } from 'mongoose';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import {
  IRouteStopRepository,
  RouteStopInput,
  RouteStopRecord,
} from '../../domain/interfaces/route-stop-repository.interface';
import { RouteStopModel, RouteStopDocument } from '../models/routeStop.model';

type RouteStopDocSource = RouteStopDocument | HydratedDocument<RouteStopDocument>;

function mapDoc(doc: RouteStopDocSource): RouteStopRecord {
  return {
    id: doc._id.toString(),
    routeId: doc.routeId.toString(),
    scheduleId: doc.scheduleId.toString(),
    sequence: doc.sequence,
    type: doc.type,
    name: doc.name,
    address: doc.address,
    status: doc.status ?? RouteStopStatus.PENDING,
    accessCode: doc.accessCode ?? null,
    deliveryPhotoUrl: doc.deliveryPhotoUrl ?? null,
    returnReason: doc.returnReason ?? null,
    returnReasonCustom: doc.returnReasonCustom ?? null,
    completedAt: doc.completedAt ?? null,
    lat: doc.lat ?? null,
    lng: doc.lng ?? null,
    destinationLat: doc.destinationLat ?? null,
    destinationLng: doc.destinationLng ?? null,
    placeId: doc.placeId ?? null,
    proximityAnchorLat: doc.proximityAnchorLat ?? null,
    proximityAnchorLng: doc.proximityAnchorLng ?? null,
    proximityEnteredAt: doc.proximityEnteredAt ?? null,
  };
}

export class RouteStopRepository implements IRouteStopRepository {
  async findById(stopId: string): Promise<RouteStopRecord | null> {
    const doc = await RouteStopModel.findById(stopId);
    return doc ? mapDoc(doc) : null;
  }

  async findByRouteId(routeId: string): Promise<RouteStopRecord[]> {
    const docs = await RouteStopModel.find({ routeId: new Types.ObjectId(routeId) }).sort({
      sequence: 1,
    });
    return docs.map((doc) => mapDoc(doc));
  }

  async findByRouteIds(routeIds: string[]): Promise<RouteStopRecord[]> {
    if (routeIds.length === 0) return [];
    const docs = await RouteStopModel.find({
      routeId: { $in: routeIds.map((id) => new Types.ObjectId(id)) },
    }).sort({
      routeId: 1,
      sequence: 1,
    });
    return docs.map((doc) => mapDoc(doc));
  }

  async replaceForRoute(
    routeId: string,
    scheduleId: string,
    stops: RouteStopInput[]
  ): Promise<RouteStopRecord[]> {
    const routeOid = new Types.ObjectId(routeId);
    const scheduleOid = new Types.ObjectId(scheduleId);
    const existing = await RouteStopModel.find({ routeId: routeOid });
    const existingById = new Map(existing.map((doc) => [String(doc._id), doc]));
    const existingByKey = new Map(
      existing.map((doc) => [
        `${doc.name.trim().toLowerCase()}|${doc.address.trim().toLowerCase()}`,
        doc,
      ])
    );

    await RouteStopModel.deleteMany({ routeId: routeOid });
    if (stops.length === 0) return [];

    const docs = await RouteStopModel.insertMany(
      stops.map((s) => {
        const preserved =
          (s.existingStopId && existingById.get(s.existingStopId)) ||
          existingByKey.get(
            `${s.name.trim().toLowerCase()}|${s.address.trim().toLowerCase()}`
          );

        return {
          routeId: routeOid,
          scheduleId: scheduleOid,
          sequence: s.sequence,
          type: s.type,
          name: s.name.trim(),
          address: s.address.trim(),
          accessCode: s.accessCode?.trim() || null,
          destinationLat: s.destinationLat ?? null,
          destinationLng: s.destinationLng ?? null,
          placeId: s.placeId?.trim() || null,
          status: preserved?.status ?? RouteStopStatus.PENDING,
          completedAt: preserved?.completedAt ?? null,
          deliveryPhotoUrl: preserved?.deliveryPhotoUrl ?? null,
          returnReason: preserved?.returnReason ?? null,
          returnReasonCustom: preserved?.returnReasonCustom ?? null,
        };
      })
    );

    return docs.map((doc) => mapDoc(doc));
  }

  async updateById(
    stopId: string,
    patch: Partial<
      Pick<
        RouteStopRecord,
        | 'status'
        | 'accessCode'
        | 'deliveryPhotoUrl'
        | 'returnReason'
        | 'returnReasonCustom'
        | 'completedAt'
        | 'lat'
        | 'lng'
        | 'destinationLat'
        | 'destinationLng'
        | 'placeId'
        | 'proximityAnchorLat'
        | 'proximityAnchorLng'
        | 'proximityEnteredAt'
      >
    >
  ): Promise<RouteStopRecord | null> {
    const doc = await RouteStopModel.findByIdAndUpdate(stopId, { $set: patch }, {
      returnDocument: 'after',
    });
    return doc ? mapDoc(doc) : null;
  }

  async deleteByRouteId(routeId: string): Promise<void> {
    await RouteStopModel.deleteMany({ routeId: new Types.ObjectId(routeId) });
  }

  async deleteByScheduleId(scheduleId: string): Promise<void> {
    await RouteStopModel.deleteMany({ scheduleId: new Types.ObjectId(scheduleId) });
  }
}
