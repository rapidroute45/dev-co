import { resolveRouteOpsRecipientIds } from '../../../../shared/services/routeOpsRecipients.service';
import { resolveDisplayName } from '../../../../shared/utils/displayName';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import {
  STALE_LOCATION_CHECK_INTERVAL_MS,
  STALE_LOCATION_THRESHOLD_MS,
} from '../constants/driverLocationMonitor.constants';

export class DriverLocationStaleMonitorService {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository,
    private userRepo: IUserRepository,
    private notificationService: NotificationService
  ) {}

  start() {
    if (this.timer) return;
    void this.scan();
    this.timer = setInterval(() => {
      void this.scan();
    }, STALE_LOCATION_CHECK_INTERVAL_MS);
  }

  async clearStaleAlert(routeId: string) {
    await this.routeRepo.update(routeId, {
      driverLocationStaleAlertSentAt: null,
    });
  }

  private async scan() {
    try {
      await this.runScan();
    } catch (err) {
      console.error('[DriverLocationStaleMonitor] scan failed:', err);
    }
  }

  private async runScan() {
    const routes = await this.routeRepo.findInProgressWithDriver();
    const now = Date.now();

    for (const route of routes) {
      if (!route.id || !route.driverId) continue;

      const lastIngest = route.driverLocationIngestedAt ?? route.driverLocationAt;
      if (!lastIngest) continue;
      if (route.driverLocationStaleAlertSentAt) continue;

      const ageMs = now - lastIngest.getTime();
      if (ageMs < STALE_LOCATION_THRESHOLD_MS) continue;

      const schedule = await this.scheduleRepo.findById(route.scheduleId);
      const driver = await this.userRepo.findById(route.driverId);
      const driverName = driver ? resolveDisplayName(driver.fullName, driver.email) : 'Driver';
      const recipients = await resolveRouteOpsRecipientIds(
        this.userRepo,
        schedule?.city ?? null,
        [route.driverId]
      );

      if (recipients.length > 0) {
        const minutes = Math.max(1, Math.floor(ageMs / 60_000));
        await this.notificationService.notifyDriverLocationStale({
          recipientIds: recipients,
          routeId: route.id,
          scheduleId: route.scheduleId,
          driverId: route.driverId,
          driverName,
          minutes,
          city: schedule?.city ?? null,
        });
      }

      await this.routeRepo.update(route.id, {
        driverLocationStaleAlertSentAt: new Date(),
      });
    }
  }
}

export function startDriverLocationStaleMonitor(
  service: DriverLocationStaleMonitorService
) {
  service.start();
}
