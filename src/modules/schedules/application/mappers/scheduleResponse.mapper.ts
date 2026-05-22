import { Schedule } from '../../domain/entities/schedule.entity';
import { Route } from '../../domain/entities/route.entity';
import { RouteStatus } from '../../../../shared/constants/routeStatuses';
import { formatScheduleDate } from '../utils/scheduleDate';

function countPendingRoutes(routes: ReturnType<typeof mapRouteToResponse>[]): number {
  return routes.filter(
    (r) => r.status === RouteStatus.PENDING || r.status === RouteStatus.ASSIGNED
  ).length;
}

export function mapScheduleToResponse(
  schedule: Schedule,
  store?: {
    id: string;
    storeName: string;
    storeId: string;
    city: string;
    state: string;
    address?: string | null;
  } | null,
  routes?: ReturnType<typeof mapRouteToResponse>[],
  counts?: { routeCount?: number; pendingRouteCount?: number }
) {
  const routeList = routes ?? [];
  return {
    id: schedule.id,
    date: formatScheduleDate(schedule.date),
    city: schedule.city,
    state: schedule.state,
    storeId: schedule.storeId,
    store: store ?? null,
    status: schedule.status,
    notes: schedule.notes,
    createdBy: schedule.createdBy,
    routes: routeList,
    routeCount: counts?.routeCount ?? routeList.length,
    pendingRouteCount:
      counts?.pendingRouteCount ??
      (routeList.length > 0 ? countPendingRoutes(routeList) : 0),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

export function mapRouteToResponse(
  route: Route,
  extras?: {
    teamName?: string;
    teamCode?: string;
    driverEmail?: string;
    driverName?: string | null;
    pickup?: { name: string; address: string; status?: string; id?: string } | null;
    dropoffs?: Record<string, unknown>[];
    progress?: {
      totalDropoffs: number;
      completedDropoffs: number;
      returnedDropoffs: number;
      pendingDropoffs: number;
    };
    driverLocation?: { lat: number; lng: number; updatedAt?: Date | null } | null;
    totalMiles?: number | null;
  }
) {
  return {
    id: route.id,
    scheduleId: route.scheduleId,
    scheduleDate: formatScheduleDate(route.scheduleDate),
    teamId: route.teamId,
    teamName: extras?.teamName,
    teamCode: extras?.teamCode,
    driverId: route.driverId,
    driverEmail: extras?.driverEmail,
    driverName: extras?.driverName,
    routeName: route.routeName,
    location: route.location,
    vehicleType: route.vehicleType,
    mileage: route.mileage,
    stops: route.stops,
    pickup: extras?.pickup ?? null,
    dropoffs: extras?.dropoffs ?? [],
    progress: extras?.progress ?? null,
    driverLocation: extras?.driverLocation ?? null,
    totalMiles: extras?.totalMiles ?? route.totalMiles ?? null,
    arrivalTime: route.arrivalTime,
    departureTime: route.departureTime,
    arrivalMinutes: route.arrivalMinutes,
    departureMinutes: route.departureMinutes,
    status: route.status,
    assignedBy: route.assignedBy,
    notes: route.notes,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
  };
}
