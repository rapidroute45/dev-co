import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';

export type RouteStopRecord = {
  id?: string;
  routeId: string;
  scheduleId: string;
  sequence: number;
  type: 'pickup' | 'dropoff';
  name: string;
  address: string;
  status: RouteStopStatus;
  accessCode: string | null;
  deliveryPhotoUrl: string | null;
  returnReason: string | null;
  returnReasonCustom: string | null;
  completedAt: Date | null;
  lat: number | null;
  lng: number | null;
  proximityEnteredAt: Date | null;
};

export type RouteStopInput = {
  type: 'pickup' | 'dropoff';
  sequence: number;
  name: string;
  address: string;
  accessCode?: string | null;
};

export interface IRouteStopRepository {
  findByRouteId(routeId: string): Promise<RouteStopRecord[]>;
  findByRouteIds(routeIds: string[]): Promise<RouteStopRecord[]>;
  replaceForRoute(
    routeId: string,
    scheduleId: string,
    stops: RouteStopInput[]
  ): Promise<RouteStopRecord[]>;
  deleteByRouteId(routeId: string): Promise<void>;
  deleteByScheduleId(scheduleId: string): Promise<void>;
  findById(stopId: string): Promise<RouteStopRecord | null>;
  updateById(
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
        | 'proximityEnteredAt'
      >
    >
  ): Promise<RouteStopRecord | null>;
}
