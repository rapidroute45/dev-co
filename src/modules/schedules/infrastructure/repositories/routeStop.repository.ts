import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import {
  IRouteStopRepository,
  RouteStopInput,
  RouteStopRecord,
} from '../../domain/interfaces/route-stop-repository.interface';
import { RouteStopModel } from '../models/routeStop.model';

function mapDoc(doc: {
  _id: { toString(): string };
  routeId: { toString(): string };
  scheduleId: { toString(): string };
  sequence: number;
  type: string;
  name: string;
  address: string;
  status?: string;
  accessCode?: string | null;
  deliveryPhotoUrl?: string | null;
  returnReason?: string | null;
  returnReasonCustom?: string | null;
  completedAt?: Date | null;
  lat?: number | null;
  lng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  placeId?: string | null;
  proximityAnchorLat?: number | null;
  proximityAnchorLng?: number | null;
  proximityEnteredAt?: Date | null;
}): RouteStopRecord {
  return {
    id: doc._id.toString(),
    routeId: doc.routeId.toString(),
    scheduleId: doc.scheduleId.toString(),
    sequence: doc.sequence,
    type: doc.type as RouteStopRecord['type'],
    name: doc.name,
    address: doc.address,
    status: (doc.status as RouteStopStatus) ?? RouteStopStatus.PENDING,
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
    const docs = await RouteStopModel.find({ routeId }).sort({ sequence: 1 });
    return docs.map(mapDoc);
  }

  async findByRouteIds(routeIds: string[]): Promise<RouteStopRecord[]> {
    if (routeIds.length === 0) return [];
    const docs = await RouteStopModel.find({ routeId: { $in: routeIds } }).sort({
      routeId: 1,
      sequence: 1,
    });
    return docs.map(mapDoc);
  }

  async replaceForRoute(
    routeId: string,
    scheduleId: string,
    stops: RouteStopInput[]
  ): Promise<RouteStopRecord[]> {
    const existing = await RouteStopModel.find({ routeId });
    const existingById = new Map(
      existing.map((doc) => [String(doc._id), doc])
    );
    const existingByKey = new Map(
      existing.map((doc) => [
        `${doc.name.trim().toLowerCase()}|${doc.address.trim().toLowerCase()}`,
        doc,
      ])
    );

    await RouteStopModel.deleteMany({ routeId });
    if (stops.length === 0) return [];

    const docs = await RouteStopModel.insertMany(
      stops.map((s) => {
        const preserved =
          (s.existingStopId && existingById.get(s.existingStopId)) ||
          existingByKey.get(
            `${s.name.trim().toLowerCase()}|${s.address.trim().toLowerCase()}`
          );

        return {
          routeId,
          scheduleId,
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

    return docs.map(mapDoc);
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
    await RouteStopModel.deleteMany({ routeId });
  }

  async deleteByScheduleId(scheduleId: string): Promise<void> {
    await RouteStopModel.deleteMany({ scheduleId });
  }
}
