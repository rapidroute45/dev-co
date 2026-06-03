import { RouteDwellStatus } from '../../../../shared/constants/routeDwellStatuses';
import {
  DWELL_RADIUS_METERS,
  DWELL_THRESHOLD_MINUTES,
} from '../../../../shared/constants/dwellDetection';
import { RouteDwellSessionModel } from '../models/routeDwellSession.model';

export type RouteDwellSessionRecord = {
  id: string;
  routeId: string;
  driverId: string;
  teamId: string;
  teamLeadId: string | null;
  centerLat: number;
  centerLng: number;
  startedAt: Date;
  lastSeenAt: Date;
  endedAt: Date | null;
  status: RouteDwellStatus;
  alertSentAt: Date | null;
  alertNotificationId: string | null;
  radiusMeters: number;
  thresholdMinutes: number;
};

function mapDoc(doc: {
  _id: { toString(): string };
  routeId: { toString(): string };
  driverId: { toString(): string };
  teamId: { toString(): string };
  teamLeadId?: { toString(): string } | null;
  centerLat: number;
  centerLng: number;
  startedAt: Date;
  lastSeenAt: Date;
  endedAt?: Date | null;
  status: RouteDwellStatus;
  alertSentAt?: Date | null;
  alertNotificationId?: { toString(): string } | null;
  radiusMeters: number;
  thresholdMinutes: number;
}): RouteDwellSessionRecord {
  return {
    id: doc._id.toString(),
    routeId: doc.routeId.toString(),
    driverId: doc.driverId.toString(),
    teamId: doc.teamId.toString(),
    teamLeadId: doc.teamLeadId?.toString() ?? null,
    centerLat: doc.centerLat,
    centerLng: doc.centerLng,
    startedAt: doc.startedAt,
    lastSeenAt: doc.lastSeenAt,
    endedAt: doc.endedAt ?? null,
    status: doc.status,
    alertSentAt: doc.alertSentAt ?? null,
    alertNotificationId: doc.alertNotificationId?.toString() ?? null,
    radiusMeters: doc.radiusMeters,
    thresholdMinutes: doc.thresholdMinutes,
  };
}

export class RouteDwellSessionRepository {
  async findActiveByRoute(routeId: string): Promise<RouteDwellSessionRecord | null> {
    const doc = await RouteDwellSessionModel.findOne({
      routeId,
      status: RouteDwellStatus.ACTIVE,
    }).sort({ startedAt: -1 });
    return doc ? mapDoc(doc) : null;
  }

  async create(params: {
    routeId: string;
    driverId: string;
    teamId: string;
    teamLeadId: string | null;
    centerLat: number;
    centerLng: number;
    startedAt: Date;
  }): Promise<RouteDwellSessionRecord> {
    const now = params.startedAt;
    const doc = await RouteDwellSessionModel.create({
      routeId: params.routeId,
      driverId: params.driverId,
      teamId: params.teamId,
      teamLeadId: params.teamLeadId,
      centerLat: params.centerLat,
      centerLng: params.centerLng,
      startedAt: now,
      lastSeenAt: now,
      status: RouteDwellStatus.ACTIVE,
      radiusMeters: DWELL_RADIUS_METERS,
      thresholdMinutes: DWELL_THRESHOLD_MINUTES,
    });
    return mapDoc(doc);
  }

  async updateById(
    id: string,
    patch: Partial<{
      lastSeenAt: Date;
      endedAt: Date | null;
      status: RouteDwellStatus;
      alertSentAt: Date | null;
      alertNotificationId: string | null;
    }>
  ): Promise<RouteDwellSessionRecord | null> {
    const doc = await RouteDwellSessionModel.findByIdAndUpdate(id, patch, {
      returnDocument: 'after',
    });
    return doc ? mapDoc(doc) : null;
  }

  async resolveActiveByRoute(routeId: string, endedAt: Date): Promise<void> {
    await RouteDwellSessionModel.updateMany(
      { routeId, status: RouteDwellStatus.ACTIVE },
      { status: RouteDwellStatus.RESOLVED, endedAt }
    );
  }
}
