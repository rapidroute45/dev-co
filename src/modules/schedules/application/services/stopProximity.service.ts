import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import {
  DWELL_THRESHOLD_MS,
  STOP_ANCHOR_RADIUS_METERS,
  STOP_APPROACH_RADIUS_METERS,
  STOP_ZONE_EXIT_METERS,
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
  }): Promise<AutoCompletedStop[]> {
    const { routeId, lat, lng, recordedAt } = params;
    const geocodeContext = await this.resolveGeocodeContext(routeId);
    const stops = await this.routeStopRepo.findByRouteId(routeId);
    const pendingDropoffs = stops.filter(
      (s) => s.type === 'dropoff' && s.status === RouteStopStatus.PENDING && s.id
    );

    const autoCompleted: AutoCompletedStop[] = [];

    for (const stop of pendingDropoffs) {
      const stopId = stop.id!;
      const completed = await this.evaluateStop({
        stop,
        stopId,
        routeId,
        lat,
        lng,
        recordedAt,
        geocodeContext,
      });
      if (completed) {
        autoCompleted.push({ stopId, stopName: stop.name });
      }
    }

    return autoCompleted;
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
  }): Promise<boolean> {
    const { stop, stopId, routeId, lat, lng, recordedAt, geocodeContext } = params;

    let destination = await this.ensureDestination(stop, stopId, geocodeContext);
    const anchor = this.readAnchor(stop);

    if (!destination && anchor) {
      destination = anchor;
    }

    const distDest = destination
      ? haversineMeters(destination.lat, destination.lng, lat, lng)
      : null;
    const distAnchor = anchor ? haversineMeters(anchor.lat, anchor.lng, lat, lng) : null;

    const leftZone =
      destination != null &&
      distDest != null &&
      distDest > STOP_ZONE_EXIT_METERS &&
      (anchor == null || (distAnchor != null && distAnchor > STOP_ANCHOR_RADIUS_METERS * 2));

    if (leftZone) {
      if (stop.proximityEnteredAt || anchor) {
        await this.clearProximitySession(stopId);
      }
      return false;
    }

    let inApproach =
      (destination != null &&
        distDest != null &&
        distDest <= STOP_APPROACH_RADIUS_METERS) ||
      (anchor != null && distAnchor != null && distAnchor <= STOP_ANCHOR_RADIUS_METERS);

    // Geocode often lands on the street, not the building — learn from driver GPS.
    const badGeocodeButNearby =
      destination != null &&
      distDest != null &&
      distDest > STOP_APPROACH_RADIUS_METERS &&
      distDest <= 600;

    if (!inApproach && badGeocodeButNearby && !anchor) {
      inApproach = true;
    }

    if (!inApproach && !destination) {
      await this.routeStopRepo.updateById(stopId, {
        destinationLat: lat,
        destinationLng: lng,
        proximityAnchorLat: lat,
        proximityAnchorLng: lng,
        proximityEnteredAt: recordedAt,
      });
      console.log('[stop-proximity]', {
        routeId,
        stopId,
        event: 'destination_learned_from_gps',
      });
      return false;
    }

    if (!inApproach) {
      return false;
    }

    if (!anchor) {
      await this.routeStopRepo.updateById(stopId, {
        proximityAnchorLat: lat,
        proximityAnchorLng: lng,
        proximityEnteredAt: recordedAt,
      });
      console.log('[stop-proximity]', {
        routeId,
        stopId,
        event: 'anchor_set',
        distDest: distDest != null ? Math.round(distDest) : null,
      });
      return false;
    }

    if (!stop.proximityEnteredAt) {
      await this.routeStopRepo.updateById(stopId, {
        proximityEnteredAt: recordedAt,
      });
      return false;
    }

    const dwellMs = recordedAt.getTime() - stop.proximityEnteredAt.getTime();
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
        distDest: distDest != null ? Math.round(distDest) : null,
        distAnchor: Math.round(distAnchor),
      });
      return true;
    }

    return false;
  }

  private async ensureDestination(
    stop: RouteStopRecord,
    stopId: string,
    geocodeContext: GeocodeContext
  ): Promise<{ lat: number; lng: number } | null> {
    if (stop.destinationLat != null && stop.destinationLng != null) {
      return { lat: stop.destinationLat, lng: stop.destinationLng };
    }

    if (stop.lat != null && stop.lng != null && stop.status === RouteStopStatus.PENDING) {
      await this.routeStopRepo.updateById(stopId, {
        destinationLat: stop.lat,
        destinationLng: stop.lng,
        lat: null,
        lng: null,
      });
      return { lat: stop.lat, lng: stop.lng };
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
