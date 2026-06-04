import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';
import {
  DWELL_RADIUS_METERS,
  DWELL_THRESHOLD_MS,
} from '../../../../shared/constants/dwellDetection';
import { IRouteStopRepository } from '../../domain/interfaces/route-stop-repository.interface';
import { haversineMeters } from '../utils/haversine';
import { geocodeAddress } from '../utils/geocodeAddress';

export type AutoCompletedStop = {
  stopId: string;
  stopName: string;
};

export class StopProximityService {
  constructor(private routeStopRepo: IRouteStopRepository) {}

  async evaluateDriverAtStops(params: {
    routeId: string;
    lat: number;
    lng: number;
    recordedAt: Date;
  }): Promise<AutoCompletedStop[]> {
    const { routeId, lat, lng, recordedAt } = params;
    const stops = await this.routeStopRepo.findByRouteId(routeId);
    const pendingDropoffs = stops.filter(
      (s) => s.type === 'dropoff' && s.status === RouteStopStatus.PENDING && s.id
    );

    const autoCompleted: AutoCompletedStop[] = [];

    for (const stop of pendingDropoffs) {
      const stopId = stop.id!;
      let stopLat = stop.lat;
      let stopLng = stop.lng;

      if (stopLat == null || stopLng == null) {
        const geo = await geocodeAddress(stop.address);
        if (!geo) continue;
        stopLat = geo.lat;
        stopLng = geo.lng;
        await this.routeStopRepo.updateById(stopId, { lat: stopLat, lng: stopLng });
      }

      const distanceM = haversineMeters(stopLat, stopLng, lat, lng);

      if (distanceM > DWELL_RADIUS_METERS) {
        if (stop.proximityEnteredAt) {
          await this.routeStopRepo.updateById(stopId, { proximityEnteredAt: null });
        }
        continue;
      }

      const enteredAt = stop.proximityEnteredAt ?? recordedAt;
      if (!stop.proximityEnteredAt) {
        await this.routeStopRepo.updateById(stopId, { proximityEnteredAt: recordedAt });
        continue;
      }

      const dwellMs = recordedAt.getTime() - enteredAt.getTime();
      if (dwellMs < DWELL_THRESHOLD_MS) continue;

      const updated = await this.routeStopRepo.updateById(stopId, {
        status: RouteStopStatus.COMPLETED,
        completedAt: recordedAt,
        lat,
        lng,
        deliveryPhotoUrl: null,
        returnReason: null,
        returnReasonCustom: null,
        proximityEnteredAt: null,
      });

      if (updated) {
        autoCompleted.push({ stopId, stopName: stop.name });
        console.log('[stop-auto-complete]', {
          routeId,
          stopId,
          stopName: stop.name,
          dwellMs,
          distanceM: Math.round(distanceM),
        });
      }
    }

    return autoCompleted;
  }
}
