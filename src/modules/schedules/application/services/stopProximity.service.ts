import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import {
  DWELL_THRESHOLD_MS,
  STOP_ANCHOR_RADIUS_METERS,
  STOP_APPROACH_RADIUS_METERS,
} from '../../../../shared/constants/dwellDetection';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IRouteStopRepository, RouteStopRecord } from '../../domain/interfaces/route-stop-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { haversineMeters } from '../utils/haversine';
import { geocodeAddress, type GeocodeContext } from '../utils/geocodeAddress';

export type AutoCompletedStop = {
  stopId: string;
  stopName: string;
};

/** Shown on driver app so they know the dwell timer is running. */
export type StopArrivalStatus = {
  stopId: string;
  stopName: string;
  inZone: boolean;
  dwellSeconds: number;
  thresholdSeconds: number;
};

const ANCHOR_EXIT_METERS = STOP_ANCHOR_RADIUS_METERS * 1.5;
const GEOCODE_MISMATCH_REFINE_METERS = 150;

export class StopProximityService {
  constructor(
    private routeStopRepo: IRouteStopRepository,
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository
  ) {}

  async evaluateDriverAtStops(params: {
    routeId: string;
    lat: number;
    lng: number;
    recordedAt: Date;
  }): Promise<{ autoCompleted: AutoCompletedStop[]; arrival: StopArrivalStatus | null }> {
    const { routeId, lat, lng, recordedAt } = params;
    const geocodeContext = await this.resolveGeocodeContext(routeId);
    const stops = await this.routeStopRepo.findByRouteId(routeId);
    const pendingDropoffs = stops
      .filter((s) => s.type === 'dropoff' && s.status === RouteStopStatus.PENDING && s.id)
      .sort((a, b) => a.sequence - b.sequence);

    const autoCompleted: AutoCompletedStop[] = [];
    const nextPendingId = pendingDropoffs[0]?.id ?? null;

    for (const meta of pendingDropoffs) {
      const stopId = meta.id!;
      const stop = (await this.routeStopRepo.findById(stopId)) ?? meta;
      const completed = await this.evaluateStop({
        stop,
        stopId,
        routeId,
        lat,
        lng,
        recordedAt,
        geocodeContext,
        isNextPending: stopId === nextPendingId,
      });
      if (completed) {
        autoCompleted.push({ stopId, stopName: stop.name });
      }
    }

    let arrival: StopArrivalStatus | null = null;
    if (nextPendingId) {
      const fresh = await this.routeStopRepo.findById(nextPendingId);
      if (fresh) {
        arrival = this.buildArrivalStatus(fresh, lat, lng, recordedAt);
      }
    }

    return { autoCompleted, arrival };
  }

  private async resolveGeocodeContext(routeId: string): Promise<GeocodeContext> {
    const route = await this.routeRepo.findById(routeId);
    if (!route?.scheduleId) return {};
    const schedule = await this.scheduleRepo.findById(route.scheduleId);
    if (!schedule) return {};
    return {
      city: schedule.city,
      state: schedule.state,
      country: 'Pakistan',
    };
  }

  private async evaluateStop(params: {
    stop: RouteStopRecord;
    stopId: string;
    routeId: string;
    lat: number;
    lng: number;
    recordedAt: Date;
    geocodeContext: GeocodeContext;
    isNextPending: boolean;
  }): Promise<boolean> {
    const { stop, stopId, routeId, lat, lng, recordedAt, geocodeContext, isNextPending } =
      params;

    const destination = await this.ensureDestination(stop, stopId, geocodeContext);
    let anchor = this.readAnchor(stop);

    const distDest =
      destination != null
        ? haversineMeters(destination.lat, destination.lng, lat, lng)
        : null;
    let distAnchor = anchor ? haversineMeters(anchor.lat, anchor.lng, lat, lng) : null;

    if (anchor && distAnchor != null && distAnchor > ANCHOR_EXIT_METERS) {
      await this.clearProximitySession(stopId);
      anchor = null;
      distAnchor = null;
      console.log('[stop-proximity]', { routeId, stopId, event: 'left_anchor_zone' });
      return false;
    }

    let inZone = false;

    if (anchor && distAnchor != null && distAnchor <= STOP_ANCHOR_RADIUS_METERS) {
      inZone = true;
    } else if (destination && distDest != null && distDest <= STOP_APPROACH_RADIUS_METERS) {
      inZone = true;
    } else if (
      isNextPending &&
      !destination &&
      distDest == null
    ) {
      await this.routeStopRepo.updateById(stopId, {
        destinationLat: lat,
        destinationLng: lng,
        proximityAnchorLat: lat,
        proximityAnchorLng: lng,
        proximityEnteredAt: recordedAt,
      });
      console.log('[stop-proximity]', { routeId, stopId, event: 'learned_stop_from_gps' });
      return false;
    } else if (
      isNextPending &&
      destination &&
      distDest != null &&
      distDest > STOP_APPROACH_RADIUS_METERS &&
      distDest <= 600
    ) {
      inZone = true;
    }

    if (!inZone) {
      return false;
    }

    if (!anchor) {
      const patch: Parameters<IRouteStopRepository['updateById']>[1] = {
        proximityAnchorLat: lat,
        proximityAnchorLng: lng,
        proximityEnteredAt: recordedAt,
      };
      if (
        destination &&
        distDest != null &&
        distDest > GEOCODE_MISMATCH_REFINE_METERS
      ) {
        patch.destinationLat = lat;
        patch.destinationLng = lng;
        console.log('[stop-proximity]', {
          routeId,
          stopId,
          event: 'refined_destination_to_driver_gps',
          distDestM: Math.round(distDest),
        });
      }
      await this.routeStopRepo.updateById(stopId, patch);
      return false;
    }

    const enteredAt = stop.proximityEnteredAt ?? recordedAt;
    if (!stop.proximityEnteredAt) {
      await this.routeStopRepo.updateById(stopId, { proximityEnteredAt: recordedAt });
      return false;
    }

    const dwellMs = recordedAt.getTime() - enteredAt.getTime();
    if (dwellMs < DWELL_THRESHOLD_MS) {
      return false;
    }

    if (distAnchor == null || distAnchor > STOP_ANCHOR_RADIUS_METERS) {
      return false;
    }

    const updated = await this.routeStopRepo.updateById(stopId, {
      status: RouteStopStatus.COMPLETED,
      completedAt: recordedAt,
      lat,
      lng,
      deliveryPhotoUrl: null,
      returnReason: null,
      returnReasonCustom: null,
      proximityEnteredAt: null,
      proximityAnchorLat: null,
      proximityAnchorLng: null,
    });

    if (updated) {
      console.log('[stop-auto-complete]', {
        routeId,
        stopId,
        stopName: stop.name,
        dwellMs,
        distAnchorM: Math.round(distAnchor),
      });
      return true;
    }

    return false;
  }

  private buildArrivalStatus(
    stop: RouteStopRecord,
    lat: number,
    lng: number,
    recordedAt: Date
  ): StopArrivalStatus {
    const anchor = this.readAnchor(stop);
    const destination =
      stop.destinationLat != null && stop.destinationLng != null
        ? { lat: stop.destinationLat, lng: stop.destinationLng }
        : null;

    const distAnchor = anchor
      ? haversineMeters(anchor.lat, anchor.lng, lat, lng)
      : null;
    const distDest = destination
      ? haversineMeters(destination.lat, destination.lng, lat, lng)
      : null;

    const inZone =
      (distAnchor != null && distAnchor <= STOP_ANCHOR_RADIUS_METERS) ||
      (distDest != null && distDest <= STOP_APPROACH_RADIUS_METERS);

    const enteredAt = stop.proximityEnteredAt;
    const dwellSeconds = enteredAt
      ? Math.max(0, Math.floor((recordedAt.getTime() - enteredAt.getTime()) / 1000))
      : 0;

    return {
      stopId: stop.id!,
      stopName: stop.name,
      inZone,
      dwellSeconds,
      thresholdSeconds: Math.floor(DWELL_THRESHOLD_MS / 1000),
    };
  }

  private async ensureDestination(
    stop: RouteStopRecord,
    stopId: string,
    geocodeContext: GeocodeContext
  ): Promise<{ lat: number; lng: number } | null> {
    if (stop.destinationLat != null && stop.destinationLng != null) {
      return { lat: stop.destinationLat, lng: stop.destinationLng };
    }

    const geo = await geocodeAddress(stop.address, geocodeContext);
    if (!geo) {
      return null;
    }

    await this.routeStopRepo.updateById(stopId, {
      destinationLat: geo.lat,
      destinationLng: geo.lng,
    });

    return geo;
  }

  private readAnchor(stop: RouteStopRecord): { lat: number; lng: number } | null {
    if (stop.proximityAnchorLat == null || stop.proximityAnchorLng == null) {
      return null;
    }
    return { lat: stop.proximityAnchorLat, lng: stop.proximityAnchorLng };
  }

  private async clearProximitySession(stopId: string): Promise<void> {
    await this.routeStopRepo.updateById(stopId, {
      proximityEnteredAt: null,
      proximityAnchorLat: null,
      proximityAnchorLng: null,
    });
  }
}
