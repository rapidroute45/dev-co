import { RouteDwellStatus } from '../../../../shared/constants/routeDwellStatuses';
import {
  DWELL_RADIUS_METERS,
} from '../../../../shared/constants/dwellDetection';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { RouteDwellSessionRepository } from '../../infrastructure/repositories/routeDwellSession.repository';
import { haversineMeters } from '../utils/haversine';

export type DwellEvaluationResult = {
  active: boolean;
  minutes: number;
  alertSent: boolean;
  sessionId: string | null;
};

export class DwellDetectionService {
  constructor(
    private dwellSessionRepo: RouteDwellSessionRepository,
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository,
    private notificationService: NotificationService
  ) {}

  async evaluateLocationPing(params: {
    routeId: string;
    driverId: string;
    teamId: string;
    lat: number;
    lng: number;
    recordedAt: Date;
  }): Promise<DwellEvaluationResult> {
    const { routeId, driverId, teamId, lat, lng, recordedAt } = params;
    let session = await this.dwellSessionRepo.findActiveByRoute(routeId);

    if (!session) {
      session = await this.startSession({
        routeId,
        driverId,
        teamId,
        lat,
        lng,
        recordedAt,
      });
      return this.toResult(session, recordedAt);
    }

    const distanceM = haversineMeters(session.centerLat, session.centerLng, lat, lng);
    const radius = session.radiusMeters ?? DWELL_RADIUS_METERS;

    if (distanceM <= radius) {
      session =
        (await this.dwellSessionRepo.updateById(session.id, {
          lastSeenAt: recordedAt,
        })) ?? session;

      const dwellMs = recordedAt.getTime() - session.startedAt.getTime();
      const thresholdMs = (session.thresholdMinutes ?? 20) * 60 * 1000;

      if (dwellMs >= thresholdMs && !session.alertSentAt) {
        const notificationId = await this.sendDwellAlert(session, dwellMs, recordedAt);
        session =
          (await this.dwellSessionRepo.updateById(session.id, {
            alertSentAt: recordedAt,
            alertNotificationId: notificationId,
          })) ?? session;
      }

      return this.toResult(session, recordedAt);
    }

    await this.dwellSessionRepo.updateById(session.id, {
      status: RouteDwellStatus.RESOLVED,
      endedAt: recordedAt,
    });

    const next = await this.startSession({
      routeId,
      driverId,
      teamId,
      lat,
      lng,
      recordedAt,
    });
    return this.toResult(next, recordedAt);
  }

  async resolveActiveSessions(routeId: string): Promise<void> {
    await this.dwellSessionRepo.resolveActiveByRoute(routeId, new Date());
  }

  private async startSession(params: {
    routeId: string;
    driverId: string;
    teamId: string;
    lat: number;
    lng: number;
    recordedAt: Date;
  }) {
    const team = await this.teamRepo.findById(params.teamId);
    return this.dwellSessionRepo.create({
      routeId: params.routeId,
      driverId: params.driverId,
      teamId: params.teamId,
      teamLeadId: team?.teamLeadId ?? null,
      centerLat: params.lat,
      centerLng: params.lng,
      startedAt: params.recordedAt,
    });
  }

  private async sendDwellAlert(
    session: {
      id: string;
      routeId: string;
      driverId: string;
      teamLeadId: string | null;
      centerLat: number;
      centerLng: number;
      startedAt: Date;
    },
    dwellMs: number,
    _recordedAt: Date
  ): Promise<string | null> {
    const recipientIds = await this.resolveDwellAlertRecipients(session.teamLeadId);
    if (recipientIds.length === 0) return null;

    const driver = await this.userRepo.findById(session.driverId);
    const driverName =
      driver?.fullName?.trim() || driver?.email?.split('@')[0] || 'Driver';
    const dwellMinutes = Math.floor(dwellMs / 60_000);

    const notifications = await this.notificationService.notifyDriverDwelling({
      recipientIds,
      routeId: session.routeId,
      driverId: session.driverId,
      driverName,
      dwellSessionId: session.id,
      centerLat: session.centerLat,
      centerLng: session.centerLng,
      dwellMinutes,
      startedAt: session.startedAt.toISOString(),
    });

    return notifications[0]?.id ?? null;
  }

  /** Team lead for the route's team + all active dispatch managers (+ admins). */
  private async resolveDwellAlertRecipients(
    teamLeadId: string | null
  ): Promise<string[]> {
    const ids = new Set<string>();
    if (teamLeadId) ids.add(teamLeadId);

    const [managers, admins] = await Promise.all([
      this.userRepo.findMany({
        role: UserRole.DISPATCH_MANAGER,
        status: UserStatus.ACTIVE,
      }),
      this.userRepo.findMany({
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      }),
    ]);

    for (const u of managers) {
      if (u.id) ids.add(u.id);
    }
    for (const u of admins) {
      if (u.id) ids.add(u.id);
    }

    return [...ids];
  }

  private toResult(
    session: {
      id: string;
      startedAt: Date;
      alertSentAt: Date | null;
      status: RouteDwellStatus;
    },
    at: Date
  ): DwellEvaluationResult {
    const dwellMs = at.getTime() - session.startedAt.getTime();
    const minutes = Math.max(0, Math.floor(dwellMs / 60_000));
    return {
      active: session.status === RouteDwellStatus.ACTIVE,
      minutes,
      alertSent: Boolean(session.alertSentAt),
      sessionId: session.id,
    };
  }
}
