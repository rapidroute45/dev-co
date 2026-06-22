import { DriverLocationModel } from '../models/driverLocation.model';

export type DriverLocationPoint = {
  lat: number;
  lng: number;
  recordedAt: Date;
};

export class DriverLocationRepository {
  async savePoint(params: {
    routeId: string;
    driverId: string;
    lat: number;
    lng: number;
    recordedAt?: Date;
  }): Promise<DriverLocationPoint> {
    const recordedAt = params.recordedAt ?? new Date();
    const doc = await DriverLocationModel.create({
      routeId: params.routeId,
      driverId: params.driverId,
      lat: params.lat,
      lng: params.lng,
      recordedAt,
    });
    return {
      lat: doc.lat,
      lng: doc.lng,
      recordedAt: doc.recordedAt,
    };
  }

  async listByRoute(routeId: string): Promise<DriverLocationPoint[]> {
    const docs = await DriverLocationModel.find({ routeId }).sort({ recordedAt: 1 });
    return docs.map((d) => ({
      lat: d.lat,
      lng: d.lng,
      recordedAt: d.recordedAt,
    }));
  }

  async getLatest(routeId: string): Promise<DriverLocationPoint | null> {
    const doc = await DriverLocationModel.findOne({ routeId }).sort({ recordedAt: -1 });
    if (!doc) return null;
    return { lat: doc.lat, lng: doc.lng, recordedAt: doc.recordedAt };
  }

  async deleteByRouteId(routeId: string): Promise<void> {
    await DriverLocationModel.deleteMany({ routeId });
  }
}
